import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { zh } from "@blocknote/core/locales";
import { useEffect, useRef } from "react";
import { uploadMedia } from "./ArticleStore.js";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export function BlockDocument({ article, editable = false, onChange, onSelection, onReady }) {
  const container = useRef(null);
  const editor = useCreateBlockNote({ initialContent: article.blocks, dictionary: zh, uploadFile: uploadMedia });
  useEffect(() => {
    onReady?.(container.current, editor);
  }, [editor]);
  return (
    <div ref={container} className={editable ? "document-surface document-editable" : "document-surface document-reader"}>
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={editable}
        formattingToolbar={editable}
        sideMenu={editable}
        slashMenu={editable}
        linkToolbar={editable}
        filePanel={editable}
        tableHandles={editable}
        onChange={() => onChange?.(editor.document)}
        onSelectionChange={() => onSelection?.(editor.getSelection()?.blocks[0]?.id ?? editor.getTextCursorPosition().block.id)}
      />
    </div>
  );
}
