export const enum NothingSelected {
  /** Default paste behaviour */
  doNothing,
  /** Automatically select word surrounding the cursor */
  autoSelect,
  /** Insert `[](url)` */
  insertInline,
  /** Insert `<url>` */
  insertBare,
  /** Per-domain rule table with label extraction */
  smartLabel,
}

export type SmartLabelBehavior =
  | "asis"
  | "titlecase"
  | "uppercase"
  | "lowercase"
  | "prefixonly"
  | "donothing"
  | "autoselect"
  | "insertinline"
  | "insertbare";

export interface SmartLabelRule {
  pattern: string;
  prefix: string;
  behavior: SmartLabelBehavior;
}

export interface SmartLabelDefault {
  prefix: string;
  behavior: SmartLabelBehavior;
}

export interface PluginSettings {
  regex: string;
  nothingSelected: NothingSelected;
  listForImgEmbed: string;
  smartLabelRules: SmartLabelRule[];
  smartLabelDefault: SmartLabelDefault;
}
