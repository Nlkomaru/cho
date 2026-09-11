import { v7 as uuidv7 } from "uuid";

// 全テーブルの主キーは UUIDv7 とする。乱数部は CSPRNG 由来で、時系列に単調増加するため
// 作成順の並びと cursor の安定した tiebreaker に使える
export const newId = (): string => uuidv7();
