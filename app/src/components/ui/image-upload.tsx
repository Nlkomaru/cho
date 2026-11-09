import { Box, chakra, HStack, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { CircleAlert, ImageOff, ImagePlus, RotateCw, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import {
  acceptedImageTypes,
  checkImageFile,
  discardImage,
  imageLimitText,
  uploadImage,
  type UploadedImage,
} from "@/lib/images";

import { Button } from "./button";

export interface ImageUploadItem {
  key: string;
  /** アップロード済みなら画像 ID。 */
  id?: string;
  /** 表示用 URL (画像 API か、選択中ファイルの object URL)。 */
  src: string;
  status: "uploading" | "ready" | "error";
  /** status が error のときの理由。 */
  error?: string;
  /** false なら再試行を出さない (形式・サイズの誤りなど)。 */
  retryable?: boolean;
}

export interface ImageUploadProps {
  /** cover: 16:9 の 1 枚。tiles: 正方形のタイルを 4 列。 */
  variant: "cover" | "tiles";
  items: readonly ImageUploadItem[];
  /** 選べる枚数。cover は 1 枚。 */
  max?: number;
  /** 読み上げ名と代替テキストに使う ("表紙画像"、"手順2 の写真" など)。 */
  label: string;
  disabled?: boolean;
  onAdd(files: File[]): void;
  onRemove(key: string): void;
  onRetry?(key: string): void;
}

const focusRing = { outline: "2px solid {colors.navy.900}", outlineOffset: "2px" } as const;

/** ファイル選択の input。label で包んで使う。 */
function FileInput({
  id,
  label,
  multiple,
  disabled,
  limit,
  onAdd,
}: {
  id: string;
  label: string;
  multiple: boolean;
  disabled?: boolean;
  limit: number;
  onAdd(files: File[]): void;
}) {
  return (
    <chakra.input
      id={id}
      type="file"
      accept={acceptedImageTypes}
      multiple={multiple}
      disabled={disabled}
      aria-label={label}
      srOnly
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []).slice(0, limit);
        event.currentTarget.value = "";
        if (files.length) onAdd(files);
      }}
    />
  );
}

/** ドラッグ中かどうかと、ドロップを受けるハンドラ。 */
function useDropZone(limit: number, disabled: boolean | undefined, onAdd: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  const accepts = (event: DragEvent) =>
    !disabled && limit > 0 && Array.from(event.dataTransfer.types).includes("Files");
  return {
    over,
    handlers: {
      onDragOver(event: DragEvent) {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave() {
        setOver(false);
      },
      onDrop(event: DragEvent) {
        setOver(false);
        if (!accepts(event)) return;
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files).slice(0, limit);
        if (files.length) onAdd(files);
      },
    },
  };
}

/** 画像本体。読み込めないときは代わりの表示にする。 */
function Picture({ src, alt, dim }: { src: string; alt: string; dim?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  // アップロード中・失敗の画像は重ね表示で状態を出すので、ここでは地だけにする
  if (broken && dim) return null;
  if (broken)
    return (
      <Stack
        h="full"
        align="center"
        justify="center"
        gap="1"
        color="fg.subtle"
        textStyle="caption"
        textAlign="center"
        px="2"
      >
        <ImageOff size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>画像を表示できません</span>
      </Stack>
    );
  return (
    <chakra.img
      src={src}
      alt={alt}
      w="full"
      h="full"
      objectFit="cover"
      opacity={dim ? 0.4 : 1}
      transition="opacity 160ms"
      onError={() => setBroken(true)}
    />
  );
}

/** アップロード中・失敗の重ね表示。 */
function StatusOverlay({ item, compact }: { item: ImageUploadItem; compact?: boolean }) {
  if (item.status === "uploading")
    return (
      <Stack
        position="absolute"
        inset="0"
        align="center"
        justify="center"
        gap="2"
        color="fg.strong"
        textStyle="caption"
      >
        <Spinner size={compact ? "sm" : "md"} color="navy.900" />
        {compact ? <chakra.span srOnly>アップロード中</chakra.span> : <span>アップロード中</span>}
      </Stack>
    );
  if (item.status === "error")
    return (
      <Box
        position="absolute"
        inset="0"
        bg="rgba(255, 255, 255, 0.82)"
        boxShadow="inset 2px 0 0 {colors.red.600}"
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="fg.error"
      >
        <CircleAlert size={compact ? 18 : 22} strokeWidth={1.75} aria-hidden="true" />
      </Box>
    );
  return null;
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <chakra.button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      position="absolute"
      top="1"
      insetEnd="1"
      boxSize="6"
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderRadius="full"
      bg="white"
      color="fg.strong"
      boxShadow="0 0 0 1px {colors.border}"
      cursor="pointer"
      _hover={{ bg: "navy.100" }}
      _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
      _focusVisible={focusRing}
    >
      <X size={14} strokeWidth={1.75} aria-hidden="true" />
    </chakra.button>
  );
}

/** 失敗した画像の理由と操作。 */
function ErrorLine({
  item,
  name,
  disabled,
  onRetry,
  onRemove,
}: {
  item: ImageUploadItem;
  name: string;
  disabled?: boolean;
  onRetry?(key: string): void;
  onRemove(key: string): void;
}) {
  return (
    <HStack
      gap="3"
      ps="3"
      py="1"
      boxShadow="inset 2px 0 0 {colors.red.600}"
      justify="space-between"
      wrap="wrap"
      role="alert"
    >
      <Text textStyle="body.sm" color="fg.error" minW="0">
        {name}: {item.error ?? "アップロードに失敗しました"}
      </Text>
      <HStack gap="1">
        {onRetry && item.retryable !== false ? (
          <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onRetry(item.key)}>
            <RotateCw />
            再試行
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onRemove(item.key)}>
          外す
        </Button>
      </HStack>
    </HStack>
  );
}

/** 破線の追加枠。クリックでファイル選択、画像をドロップしても追加できる。 */
function AddZone({
  inputId,
  label,
  disabled,
  limit,
  multiple,
  onAdd,
  children,
  ...rest
}: {
  inputId: string;
  label: string;
  disabled?: boolean;
  limit: number;
  multiple: boolean;
  onAdd(files: File[]): void;
  children: ReactNode;
  aspectRatio: string;
}) {
  const drop = useDropZone(limit, disabled, onAdd);
  return (
    <chakra.label
      htmlFor={inputId}
      {...rest}
      {...drop.handlers}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="1"
      px="3"
      textAlign="center"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={drop.over ? "navy.900" : "border.emphasized"}
      bg={drop.over ? "navy.50" : undefined}
      color={drop.over ? "fg.strong" : "fg.muted"}
      textStyle="caption"
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.4 : 1}
      _hover={disabled ? undefined : { bg: "navy.50", color: "fg.strong" }}
      css={{ "&:has(input:focus-visible)": focusRing }}
    >
      {children}
      <FileInput
        id={inputId}
        label={label}
        multiple={multiple}
        disabled={disabled}
        limit={limit}
        onAdd={onAdd}
      />
    </chakra.label>
  );
}

function CoverUpload({ items, label, disabled, onAdd, onRemove, onRetry }: ImageUploadProps) {
  const inputId = useId();
  const item = items.at(-1);
  const busy = item?.status === "uploading";

  if (!item)
    return (
      <AddZone
        inputId={inputId}
        label={`${label}を追加`}
        disabled={disabled}
        limit={1}
        multiple={false}
        onAdd={onAdd}
        aspectRatio="16 / 9"
      >
        <ImagePlus size={24} strokeWidth={1.5} aria-hidden="true" />
        <chakra.span textStyle="body.sm" fontWeight="500">
          {label}を追加
        </chakra.span>
        <span>{imageLimitText}</span>
      </AddZone>
    );

  return (
    <Stack gap="2">
      <Box
        position="relative"
        aspectRatio="16 / 9"
        bg="bg.muted"
        overflow="hidden"
        aria-busy={busy || undefined}
      >
        <Picture src={item.src} alt={label} dim={item.status !== "ready"} />
        <StatusOverlay item={item} />
      </Box>
      {item.status === "error" ? (
        <ErrorLine
          item={item}
          name={label}
          disabled={disabled}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      ) : (
        <HStack gap="2">
          <Button
            asChild
            size="xs"
            variant="outline"
            aria-disabled={disabled || busy || undefined}
            css={{ "&:has(input:focus-visible)": focusRing }}
          >
            <label htmlFor={inputId}>
              <ImagePlus />
              変更
              <FileInput
                id={inputId}
                label={`${label}を変更`}
                multiple={false}
                disabled={disabled || busy}
                limit={1}
                onAdd={onAdd}
              />
            </label>
          </Button>
          <Button size="xs" variant="ghost" disabled={disabled} onClick={() => onRemove(item.key)}>
            外す
          </Button>
        </HStack>
      )}
    </Stack>
  );
}

function TileUpload({
  items,
  max = 4,
  label,
  disabled,
  onAdd,
  onRemove,
  onRetry,
}: ImageUploadProps) {
  const inputId = useId();
  const remaining = max - items.length;
  const failed = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === "error");

  return (
    <Stack gap="2" w="full">
      <SimpleGrid columns={4} gap="2">
        {items.map((item, index) => (
          <Box
            key={item.key}
            position="relative"
            aspectRatio="1"
            bg="bg.muted"
            overflow="hidden"
            aria-busy={item.status === "uploading" || undefined}
          >
            <Picture src={item.src} alt={`${label} ${index + 1}`} dim={item.status !== "ready"} />
            <StatusOverlay item={item} compact />
            <RemoveButton
              label={`${label} ${index + 1} を外す`}
              disabled={disabled}
              onClick={() => onRemove(item.key)}
            />
          </Box>
        ))}
        {remaining > 0 ? (
          <AddZone
            inputId={inputId}
            label={`${label}を追加`}
            disabled={disabled}
            limit={remaining}
            multiple
            onAdd={onAdd}
            aspectRatio="1"
          >
            <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>追加</span>
          </AddZone>
        ) : null}
      </SimpleGrid>
      {failed.map(({ item, index }) => (
        <ErrorLine
          key={item.key}
          item={item}
          name={`${index + 1}枚目`}
          disabled={disabled}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      ))}
    </Stack>
  );
}

/**
 * 画像の選択とアップロード状況の表示。状態は持たず、items を親から受け取る。
 * 選んだ画像はすぐにアップロードし、保存時には画像 ID だけを送る (useImageUploads)。
 */
export function ImageUpload(props: ImageUploadProps) {
  return props.variant === "cover" ? <CoverUpload {...props} /> : <TileUpload {...props} />;
}

interface PendingUpload {
  key: string;
  slot: string;
  file: File;
  src: string;
  status: "uploading" | "error";
  error?: string;
  retryable: boolean;
}

export interface UseImageUploadsOptions {
  /**
   * アップロードが終わった画像 ID を、slot ごとの保存先へ書き込む。
   * 差し替えで外れる画像があれば release に渡す。
   */
  onUploaded(slot: string, id: string, release: (id: string) => void): void;
  upload?(file: File, signal: AbortSignal): Promise<UploadedImage>;
  discard?(id: string): Promise<void>;
}

/**
 * 複数の置き場所 (slot: 表紙、手順ごとなど) の画像アップロードを管理する。
 * アップロード済みの画像 ID は親が持ち、ここではアップロード中・失敗した画像と、
 * この画面でアップロードした画像のプレビューだけを持つ。
 */
export function useImageUploads({
  onUploaded,
  upload = uploadImage,
  discard = discardImage,
}: UseImageUploadsOptions) {
  const [pending, setPending] = useState<readonly PendingUpload[]>([]);
  const previews = useRef(new Map<string, string>());
  const fresh = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const latest = useRef({ onUploaded, upload, discard });
  latest.current = { onUploaded, upload, discard };

  useEffect(() => {
    const urls = previews.current;
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  const start = useCallback((entry: PendingUpload) => {
    const controller = new AbortController();
    controllers.current.set(entry.key, controller);
    latest.current.upload(entry.file, controller.signal).then(
      ({ id }) => {
        controllers.current.delete(entry.key);
        previews.current.set(id, entry.src);
        fresh.current.add(id);
        setPending((current) => current.filter((item) => item.key !== entry.key));
        latest.current.onUploaded(entry.slot, id, (old) => {
          if (fresh.current.delete(old)) void latest.current.discard(old);
        });
      },
      (cause: unknown) => {
        controllers.current.delete(entry.key);
        if (controller.signal.aborted) return;
        const error = cause instanceof Error ? cause.message : "アップロードに失敗しました";
        setPending((current) =>
          current.map((item) =>
            item.key === entry.key ? { ...item, status: "error", error } : item,
          ),
        );
      },
    );
  }, []);

  const add = useCallback(
    (slot: string, files: readonly File[]) => {
      const entries = files.map((file): PendingUpload => {
        const problem = checkImageFile(file);
        return {
          key: `upload-${crypto.randomUUID()}`,
          slot,
          file,
          src: URL.createObjectURL(file),
          status: problem ? "error" : "uploading",
          error: problem ?? undefined,
          retryable: !problem,
        };
      });
      setPending((current) => [...current, ...entries]);
      for (const entry of entries) if (entry.status === "uploading") start(entry);
    },
    [start],
  );

  const retry = useCallback(
    (key: string) => {
      const entry = pending.find((item) => item.key === key);
      if (!entry || !entry.retryable) return;
      const next = { ...entry, status: "uploading" as const, error: undefined };
      setPending((current) => current.map((item) => (item.key === key ? next : item)));
      start(next);
    },
    [pending, start],
  );

  const cancel = useCallback((key: string) => {
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
    setPending((current) => {
      const entry = current.find((item) => item.key === key);
      if (entry) URL.revokeObjectURL(entry.src);
      return current.filter((item) => item.key !== key);
    });
  }, []);

  /** 保存済みの一覧から外した画像。この画面でアップロードしたものなら消す。 */
  const release = useCallback(
    (id: string) => {
      if (!fresh.current.delete(id)) return;
      void discard(id);
    },
    [discard],
  );

  /** slot ごと消す (手順の削除)。 */
  const dropSlot = useCallback(
    (slot: string, ids: readonly string[]) => {
      for (const entry of pending) if (entry.slot === slot) cancel(entry.key);
      for (const id of ids) release(id);
    },
    [pending, cancel, release],
  );

  /** 保存済みの画像 ID と、その slot のアップロード中・失敗の画像を並べた表示用の一覧。 */
  const itemsFor = useCallback(
    (slot: string, ids: readonly string[], resolveSrc: (id: string) => string) => [
      ...ids.map((id): ImageUploadItem => ({
        key: id,
        id,
        src: previews.current.get(id) ?? resolveSrc(id),
        status: "ready",
      })),
      ...pending
        .filter((entry) => entry.slot === slot)
        .map((entry): ImageUploadItem => ({
          key: entry.key,
          src: entry.src,
          status: entry.status,
          error: entry.error,
          retryable: entry.retryable,
        })),
    ],
    [pending],
  );

  return {
    itemsFor,
    add,
    retry,
    cancel,
    release,
    dropSlot,
    /** アップロード中の画像がある。 */
    uploading: pending.some((entry) => entry.status === "uploading"),
    /** 失敗したまま残っている画像がある。 */
    failed: pending.some((entry) => entry.status === "error"),
    isPending: (key: string) => pending.some((entry) => entry.key === key),
  };
}
