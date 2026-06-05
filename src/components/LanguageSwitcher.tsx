import { Globe } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";

const LANGS = [
  { value: "pt", label: "Português", code: "br" },
  { value: "en", label: "English", code: "us" },
  { value: "es", label: "Español", code: "es" },
];

const Flag = ({ code, className }: { code: string; className?: string }) => (
  <img
    src={`https://flagcdn.com/w40/${code}.png`}
    srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
    alt=""
    className={`block shrink-0 object-cover ${className ?? ""}`}
  />
);

export function LanguageSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language || "pt";

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Globe className="h-4 w-4 text-sidebar-foreground/70" />
      </div>
    );
  }

  const currentLang = LANGS.find((l) => l.value === current);

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={currentLang?.label}
          className="inline-flex h-4 w-[15px] items-center justify-center self-center p-0 hover:opacity-80 focus:outline-none"
        >
          {currentLang && <Flag code={currentLang.code} className="h-[11px] w-[15px] rounded-sm" />}
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="center"
          sideOffset={4}
          className="z-50 flex min-w-0 flex-col items-center overflow-hidden rounded-sm bg-popover p-1 text-popover-foreground shadow-md"
        >
        {LANGS.map((l) => (
          <DropdownMenuPrimitive.Item
            key={l.value}
            onSelect={() => i18n.changeLanguage(l.value)}
            className="flex h-[15px] w-[15px] cursor-default items-center justify-center rounded-sm p-0 outline-none focus:bg-accent"
          >
            <Flag code={l.code} className="h-[11px] w-[15px] rounded-sm" />
          </DropdownMenuPrimitive.Item>
        ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
