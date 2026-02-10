"use client";

import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  const editorRef = useRef<any>(null);

  return (
    <div className="w-full rounded-md border border-input shadow-sm overflow-hidden bg-white">
      <Editor
        tinymceScriptSrc="https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js"
        onInit={(evt, editor) => editorRef.current = editor}
        value={content}
        onEditorChange={(newContent) => onChange(newContent)}
        init={{
          height: 350,
          menubar: 'edit insert view format table tools help',
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
          ],
          toolbar: 'undo redo | blocks | ' +
            'bold italic underline forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          content_style: 'body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px }',
          placeholder: placeholder || "Escreva seu conteúdo aqui...",
          language: 'pt_BR',
          branding: false,
          statusbar: true,
          elementpath: false,
          promotion: false,
          skin: 'oxide',
          content_css: 'default'
        }}
      />
    </div>
  );
};

export default RichTextEditor;