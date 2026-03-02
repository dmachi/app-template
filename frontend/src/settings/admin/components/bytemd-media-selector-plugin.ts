import type { BytemdPlugin } from "bytemd";

type CreateBytemdMediaSelectorPluginParams = {
  onOpenMediaSelector: () => void;
};

export function createBytemdMediaSelectorPlugin({ onOpenMediaSelector }: CreateBytemdMediaSelectorPluginParams): BytemdPlugin {
  return {
    actions: [
      {
        title: "Image",
        icon: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2M8.5 11.5l2.5 3.01L14.5 10l4.5 6H5l3.5-4.5M8 8a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3\"/></svg>",
        cheatsheet: "![alt](url \"title\")",
        handler: {
          type: "action",
          click({ editor }) {
            onOpenMediaSelector();
            editor.focus();
          },
        },
      },
    ],
  };
}
