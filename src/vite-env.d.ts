/// <reference types="vite/client" />

declare module 'react-quill' {
  import { Component } from 'react';
  import Quill from 'quill';

  export interface ReactQuillProps {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    readOnly?: boolean;
    onChange?: (content: string, delta: any, source: any, editor: any) => void;
    onChangeSelection?: (range: any, source: any, editor: any) => void;
    onFocus?: (range: any, source: any, editor: any) => void;
    onBlur?: (previousRange: any, source: any, editor: any) => void;
    onKeyPress?: (event: any) => void;
    onKeyDown?: (event: any) => void;
    onKeyUp?: (event: any) => void;
    bounds?: string | HTMLElement;
    children?: React.ReactElement;
    className?: string;
    formats?: string[];
    id?: string;
    modules?: any;
    preserveWhitespace?: boolean;
    style?: React.CSSProperties;
    tabIndex?: number;
    theme?: string;
  }

  export default class ReactQuill extends Component<ReactQuillProps> {
    getEditor(): any;
    focus(): void;
    blur(): void;
  }

  export { Quill };
}
