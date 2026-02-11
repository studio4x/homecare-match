"use client";

import React from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  return (
    <div className="rich-text-editor border rounded-md overflow-hidden">
      <Editor
        apiKey="no-api-key" // Usando versão gratuita sem chave para desenvolvimento
        value={content}
        onEditorChange={(newContent) => onChange(newContent)}
        init={{
          height: 400,
          menubar: 'edit insert view format table tools help',
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount',
            'emoticons', 'directionality', 'visualchars', 'nonbreaking'
          ],
          toolbar: 'undo redo | blocks | ' +
            'bold italic underline forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | emoticons | help',
          content_style: 'body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px }',
          language: 'pt_BR',
          placeholder: placeholder || 'Comece a escrever...',
          branding: false,
          promotion: false,
          skin: 'oxide',
          content_css: 'default',
          setup: (editor) => {
            editor.on('init', () => {
              editor.getContainer().style.transition = 'border-color 0.15s ease-in-out';
            });
          }
        }}
      />
    </div>
  );
};

export default RichTextEditor;