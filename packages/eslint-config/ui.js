/**
 * Design-system guardrails. Prefer a small no-restricted-* set over a Tailwind plugin.
 * Token/color/motion rules apply to all packages; native <select>/<checkbox> only in Next apps.
 */

const PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const COLOR_UTILS =
  "bg|text|border|ring|outline|fill|stroke|from|to|via|decoration|divide|accent|caret|shadow|placeholder";
const PALETTE_CLASS = `(?:^|[\\s"'\\\`])(?:[\\w-]+:)*(?:${COLOR_UTILS})-(?:${PALETTES})(?:-|\\/|$|[\\s"'\\\`])`;

const STYLE_GUIDE = "dev-files/UI_STYLE_GUIDE.md";

function bothLiteralAndTemplate(regexSource, message) {
  return [
    { selector: `Literal[value=/${regexSource}/]`, message },
    { selector: `TemplateElement[value.raw=/${regexSource}/]`, message },
  ];
}

const tokenSyntax = [
  ...bothLiteralAndTemplate(
    PALETTE_CLASS,
    `Raw Tailwind palette colors are banned. Use semantic tokens (bg-background, text-foreground, text-destructive, bg-surface-*, bg-overlay, …). See ${STYLE_GUIDE}.`,
  ),
  ...bothLiteralAndTemplate(
    String.raw`tracking-\[[^\]]+\]`,
    `Arbitrary tracking-[…] is banned. Use text-eyebrow (0.16em) or tracking-tight. See ${STYLE_GUIDE}.`,
  ),
  ...bothLiteralAndTemplate(
    String.raw`(?:bg|text|border|ring|from|to|via|fill|stroke)-\[(?:#|rgb|hsl|oklch)`,
    `Arbitrary color values in className are banned. Add a token in packages/ui/src/styles/globals.css. See ${STYLE_GUIDE}.`,
  ),
  ...bothLiteralAndTemplate(
    String.raw`^#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$`,
    `Hex color literals are banned in TS/TSX. Define the color in packages/ui/src/styles/globals.css. See ${STYLE_GUIDE}.`,
  ),
  ...bothLiteralAndTemplate(
    String.raw`(?:^|[^a-zA-Z-])(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(`,
    `rgb()/hsl()/oklch() color literals are banned in TS/TSX. Define the color in packages/ui/src/styles/globals.css. See ${STYLE_GUIDE}.`,
  ),
];

const nativeControlSyntax = [
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: `Use Select from @selecta/ui/components/select instead of a raw <select>. See ${STYLE_GUIDE}.`,
  },
  {
    selector:
      "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value='checkbox'])",
    message: `Use Checkbox from @selecta/ui/components/checkbox instead of a raw checkbox input. See ${STYLE_GUIDE}.`,
  },
];

const confirmRules = {
  "no-restricted-globals": [
    "error",
    {
      name: "confirm",
      message: `Use ConfirmDialog from @selecta/ui/components/confirm-dialog instead of confirm(). See ${STYLE_GUIDE}.`,
    },
    {
      name: "alert",
      message: `Use Alert from @selecta/ui/components/alert instead of alert(). See ${STYLE_GUIDE}.`,
    },
  ],
  "no-restricted-properties": [
    "error",
    {
      object: "window",
      property: "confirm",
      message: `Use ConfirmDialog from @selecta/ui/components/confirm-dialog instead of window.confirm. See ${STYLE_GUIDE}.`,
    },
    {
      object: "window",
      property: "alert",
      message: `Use Alert from @selecta/ui/components/alert instead of window.alert. See ${STYLE_GUIDE}.`,
    },
  ],
};

/** @param {{ nativeControls?: boolean }} [options] */
export function designSystemConfig({ nativeControls = false } = {}) {
  return {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...tokenSyntax,
        ...(nativeControls ? nativeControlSyntax : []),
      ],
      ...confirmRules,
    },
  };
}

export const tokenSyntaxForTests = tokenSyntax;
export const nativeControlSyntaxForTests = nativeControlSyntax;
