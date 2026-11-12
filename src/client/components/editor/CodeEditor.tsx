import { useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { Prec } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { useTheme } from "../../context/ThemeContext";
import "./CodeEditor.scss";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onRun?: () => void;
  readOnly?: boolean;
}

export function CodeEditor({ value, onChange, onSave, onRun, readOnly = false }: CodeEditorProps) {
  const { theme } = useTheme();
  const onSaveRef = useRef(onSave);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onSaveRef.current = onSave;
    onRunRef.current = onRun;
  }, [onSave, onRun]);

  const extensions = useMemo(() => {
    const shortcuts = Prec.highest(
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            onSaveRef.current?.();
            return true;
          },
        },
        {
          key: "Mod-Enter",
          preventDefault: true,
          run: () => {
            onRunRef.current?.();
            return true;
          },
        },
      ]),
    );
    return [javascript({ typescript: true }), shortcuts];
  }, []);

  return (
    <div className="code-editor">
      <CodeMirror
        value={value}
        height="100%"
        theme={theme === "dark" ? oneDark : "light"}
        extensions={extensions}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          autocompletion: !readOnly,
          bracketMatching: true,
          closeBrackets: !readOnly,
          indentOnInput: !readOnly,
          tabSize: 2,
        }}
        onChange={onChange}
      />
    </div>
  );
}
