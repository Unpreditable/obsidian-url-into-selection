import UrlIntoSel_Plugin from "./main";
import { PluginSettingTab, Setting } from "obsidian";
import { NothingSelected, PluginSettings, SmartLabelBehavior, SmartLabelDefault, SmartLabelRule } from "./types";
import { isExtractionBehavior, isValidPattern } from "./utils/smartLabel";

export { NothingSelected, PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {
  regex:
    /^[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
      .source,
  nothingSelected: NothingSelected.doNothing,
  listForImgEmbed: "",
  smartLabelRules: [],
  smartLabelDefault: { prefix: "", behavior: "asis" },
};

function buildBehaviorSelect(
  container: HTMLElement,
  current: SmartLabelBehavior,
  onChange: (v: SmartLabelBehavior) => void,
): HTMLSelectElement {
  const select = container.createEl("select", { cls: "dropdown" });

  const g1 = select.createEl("optgroup");
  g1.label = "Segment transform";
  for (const [value, label] of [
    ["asis", "As is"],
    ["titlecase", "Title Case"],
    ["uppercase", "UPPERCASE"],
    ["lowercase", "lowercase"],
    ["prefixonly", "Prefix Only"],
  ] as [SmartLabelBehavior, string][]) {
    const opt = g1.createEl("option", { text: label });
    opt.value = value;
    if (value === current) opt.selected = true;
  }

  const g2 = select.createEl("optgroup");
  g2.label = "Paste behavior";
  for (const [value, label] of [
    ["donothing", "Do nothing"],
    ["autoselect", "Auto Select"],
    ["insertinline", "Insert [](url)"],
    ["insertbare", "Insert <url>"],
  ] as [SmartLabelBehavior, string][]) {
    const opt = g2.createEl("option", { text: label });
    opt.value = value;
    if (value === current) opt.selected = true;
  }

  select.addEventListener("change", () => {
    onChange(select.value as SmartLabelBehavior);
  });
  return select;
}

function renderRuleRow(
  container: HTMLElement,
  rule: SmartLabelRule,
  onDelete: () => void,
  onSave: () => void,
): void {
  const row = container.createDiv({ cls: "smart-label-rule-row" });
  if (!isValidPattern(rule.pattern)) row.addClass("smart-label-row-invalid");

  const patternInput = row.createEl("input", { type: "text", cls: "smart-label-input" });
  patternInput.placeholder = "e.g. jira.company.com";
  patternInput.value = rule.pattern;
  patternInput.addEventListener("input", () => {
    if (isValidPattern(patternInput.value)) row.removeClass("smart-label-row-invalid");
    else row.addClass("smart-label-row-invalid");
  });
  patternInput.addEventListener("change", () => {
    rule.pattern = patternInput.value;
    onSave();
  });

  const prefixInput = row.createEl("input", { type: "text", cls: "smart-label-input" });
  prefixInput.value = rule.prefix;
  if (!isExtractionBehavior(rule.behavior)) prefixInput.style.visibility = "hidden";
  prefixInput.addEventListener("change", () => {
    rule.prefix = prefixInput.value;
    onSave();
  });

  buildBehaviorSelect(row, rule.behavior, (behavior) => {
    rule.behavior = behavior;
    const active = isExtractionBehavior(behavior);
    prefixInput.style.visibility = active ? "" : "hidden";
    if (!active) { prefixInput.value = ""; rule.prefix = ""; }
    onSave();
  });

  const deleteBtn = row.createEl("button", { text: "✕" });
  deleteBtn.addEventListener("click", onDelete);
}

function renderCatchAllRow(
  container: HTMLElement,
  def: SmartLabelDefault,
  onSave: () => void,
): void {
  const row = container.createDiv({ cls: "smart-label-rule-row" });

  row.createSpan({ cls: "smart-label-catchall-label", text: "* (All)" });

  const prefixInput = row.createEl("input", { type: "text", cls: "smart-label-input" });
  prefixInput.value = def.prefix;
  if (!isExtractionBehavior(def.behavior)) prefixInput.style.visibility = "hidden";
  prefixInput.addEventListener("change", () => {
    def.prefix = prefixInput.value;
    onSave();
  });

  buildBehaviorSelect(row, def.behavior, (behavior) => {
    def.behavior = behavior;
    const active = isExtractionBehavior(behavior);
    prefixInput.style.visibility = active ? "" : "hidden";
    if (!active) { prefixInput.value = ""; def.prefix = ""; }
    onSave();
  });

  // Empty placeholder to keep grid alignment (no delete button for catch-all)
  row.createSpan();
}

export class UrlIntoSelectionSettingsTab extends PluginSettingTab {
  display() {
    let { containerEl } = this;
    const plugin: UrlIntoSel_Plugin = (this as any).plugin;

    containerEl.empty();
    containerEl.createEl("h2", { text: "URL-into-selection Settings" });

    new Setting(containerEl)
      .setName("Fallback Regular expression")
      .setDesc(
        "Regular expression used to match URLs when default match fails.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Enter regular expression here..")
          .setValue(plugin.settings.regex)
          .onChange(async (value) => {
            if (value.length > 0) {
              plugin.settings.regex = value;
              await plugin.saveSettings();
            }
          }),
      );
    new Setting(containerEl)
      .setName("Behavior on pasting URL when nothing is selected")
      .setDesc("Auto Select: Automatically select word surrounding the cursor.")
      .addDropdown((dropdown) => {
        const options: Record<NothingSelected, string> = {
          0: "Do nothing",
          1: "Auto Select",
          2: "Insert [](url)",
          3: "Insert <url>",
          4: "Smart Label",
        };

        dropdown
          .addOptions(options)
          .setValue(plugin.settings.nothingSelected.toString())
          .onChange(async (value) => {
            plugin.settings.nothingSelected = +value;
            await plugin.saveSettings();
            this.display();
          });
      });

    if (plugin.settings.nothingSelected === NothingSelected.smartLabel) {
      const block = containerEl.createDiv({ cls: "setting-item" });
      const info = block.createDiv({ cls: "setting-item-info" });
      info.createDiv({ cls: "setting-item-name", text: "Smart Label Settings" });
      info.createDiv({ cls: "setting-item-description", text: "Transforms apply to the last path segment of the URL. Rules are checked top-to-bottom; first match wins." });
      info.createDiv({ cls: "setting-item-description", text: "Use * as a wildcard to match any characters within a path segment." });
      info.createDiv({ cls: "setting-item-description", text: "Rows with an empty or an invalid pattern are ignored when matching URLs." });

      const section = info.createDiv({ cls: "smart-label-section" });

      const addBtn = section.createEl("button", { text: "+ Add Rule", cls: "smart-label-add-btn" });

      const header = section.createDiv({ cls: "smart-label-rule-header" });
      header.createSpan({ text: "Domain pattern" });
      header.createSpan({ text: "Prefix" });
      header.createSpan({ text: "Behavior" });
      header.createSpan();

      const rulesContainer = section.createDiv({ cls: "smart-label-rules" });
      const def = plugin.settings.smartLabelDefault;

      const redraw = () => {
        rulesContainer.empty();
        plugin.settings.smartLabelRules.forEach((rule, i) => {
          renderRuleRow(
            rulesContainer,
            rule,
            () => {
              plugin.settings.smartLabelRules.splice(i, 1);
              plugin.saveData(plugin.settings);
              this.display();
            },
            () => plugin.saveData(plugin.settings),
          );
        });
        renderCatchAllRow(rulesContainer, def, () => plugin.saveData(plugin.settings));
      };
      redraw();

      addBtn.addEventListener("click", () => {
        plugin.settings.smartLabelRules.push({
          pattern: "",
          prefix: "",
          behavior: "asis",
        });
        plugin.saveData(plugin.settings);
        this.display();
      });
    }
    new Setting(containerEl)
      .setName("Whitelist for image embed syntax")
      .setDesc(
        createFragment((el) => {
          el.appendText(
            "![selection](url) will be used for URL that matches the following list.",
          );
          el.createEl("br");
          el.appendText("Rules are regex-based, split by line break.");
        }),
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Example:\nyoutu.?be|vimeo")
          .setValue(plugin.settings.listForImgEmbed)
          .onChange((value) => {
            plugin.settings.listForImgEmbed = value;
            plugin.saveData(plugin.settings);
            return text;
          });
        text.inputEl.rows = 6;
        text.inputEl.cols = 25;
      });
  }
}
