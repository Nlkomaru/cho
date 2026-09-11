"use client";

import { ImagePlusIcon, Loader2Icon, TrashIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** 保存済みの画像。実体は R2 にあり、表示は /images/<key> から読む */
export interface UploadedImage {
	readonly id: string;
	readonly key: string;
	readonly alt: string | null;
}

export interface ImageUploaderProps {
	/** 追加先の種類。レシピの参照画像か、作った記録の写真か */
	readonly scope: "recipe" | "cook";
	/** 追加先の id。先にレシピや記録を保存しておく必要がある */
	readonly ownerId: string;
	readonly images: readonly UploadedImage[];
	readonly onChange: (images: readonly UploadedImage[]) => void;
	readonly label?: string;
	readonly disabled?: boolean;
}

const isUploadedImage = (value: unknown): value is UploadedImage =>
	typeof value === "object" &&
	value !== null &&
	"id" in value &&
	"key" in value &&
	typeof value.id === "string" &&
	typeof value.key === "string";

const uploadImage = async (
	scope: string,
	ownerId: string,
	file: File,
): Promise<UploadedImage> => {
	const body = new FormData();
	body.set("scope", scope);
	body.set("ownerId", ownerId);
	body.set("file", file);
	const response = await fetch("/api/images", { method: "POST", body });
	const payload: unknown = await response.json();
	if (!response.ok) {
		throw new Error(
			payload !== null &&
				typeof payload === "object" &&
				"message" in payload &&
				typeof payload.message === "string"
				? payload.message
				: "画像を保存できませんでした。",
		);
	}
	if (!isUploadedImage(payload)) {
		throw new Error("画像の保存結果を読み取れませんでした。");
	}
	return payload;
};

const deleteImage = async (key: string): Promise<void> => {
	const response = await fetch(`/api/images?key=${encodeURIComponent(key)}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error("画像を削除できませんでした。");
	}
};

/**
 * 画像の追加と削除。保存済みの対象にだけ追加できるので、呼び出し側は
 * 対象を保存してから表示する。
 */
export function ImageUploader({
	scope,
	ownerId,
	images,
	onChange,
	label = "写真",
	disabled = false,
}: ImageUploaderProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [removingKey, setRemovingKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const upload = async (files: FileList) => {
		setIsUploading(true);
		setError(null);
		try {
			const added: UploadedImage[] = [];
			for (const file of files) {
				added.push(await uploadImage(scope, ownerId, file));
			}
			onChange([...images, ...added]);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "画像を保存できませんでした。",
			);
		} finally {
			setIsUploading(false);
			if (inputRef.current) {
				inputRef.current.value = "";
			}
		}
	};

	const remove = async (key: string) => {
		setRemovingKey(key);
		setError(null);
		try {
			await deleteImage(key);
			onChange(images.filter((image) => image.key !== key));
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "画像を削除できませんでした。",
			);
		} finally {
			setRemovingKey(null);
		}
	};

	return (
		<div className="grid gap-3">
			<Label htmlFor={`image-upload-${scope}-${ownerId}`}>{label}</Label>
			{images.length > 0 ? (
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{images.map((image) => (
						<li
							key={image.id}
							className="group relative overflow-hidden rounded-lg border"
						>
							<img
								alt={image.alt ?? "保存した画像"}
								className="aspect-4/3 w-full object-cover"
								src={`/images/${image.key}`}
							/>
							<Button
								aria-label="この画像を削除"
								className="absolute top-1 right-1"
								disabled={disabled || removingKey === image.key}
								onClick={() => remove(image.key)}
								size="icon-sm"
								variant="destructive"
							>
								<TrashIcon />
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-foreground">まだ写真がありません。</p>
			)}
			<div>
				<input
					accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
					className="sr-only"
					disabled={disabled || isUploading}
					id={`image-upload-${scope}-${ownerId}`}
					multiple
					onChange={(event) => {
						if (event.target.files && event.target.files.length > 0) {
							void upload(event.target.files);
						}
					}}
					ref={inputRef}
					type="file"
				/>
				<Button
					disabled={disabled || isUploading}
					onClick={() => inputRef.current?.click()}
					type="button"
					variant="outline"
				>
					{isUploading ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<ImagePlusIcon />
					)}
					{isUploading ? "アップロードしています…" : "写真を追加"}
				</Button>
			</div>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}
		</div>
	);
}
