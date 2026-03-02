import { useMemo } from "react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";
import { createBytemdMediaSelectorPlugin } from "./bytemd-media-selector-plugin";

type LazyByteMdEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onOpenMediaSelector: () => void;
  placeholder?: string;
};

export default function LazyByteMdEditor({ value, onChange, onOpenMediaSelector, placeholder }: LazyByteMdEditorProps) {
  const plugins = useMemo(
    () => [gfm(), createBytemdMediaSelectorPlugin({ onOpenMediaSelector })],
    [onOpenMediaSelector],
  );

  return (
    <Editor value={value} onChange={onChange} plugins={plugins} mode="split" placeholder={placeholder} />
  );
}
