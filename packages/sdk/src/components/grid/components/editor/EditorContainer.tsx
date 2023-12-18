/* eslint-disable jsx-a11y/no-static-element-interactions */
import { clamp } from 'lodash';
import type { CSSProperties, ForwardRefRenderFunction } from 'react';
import { useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import type { IGridTheme } from '../../configs';
import { useKeyboardSelection } from '../../hooks';
import type { IInteractionLayerProps } from '../../InteractionLayer';
import type { IActiveCellBound, ICellItem, IRectangle, IScrollState } from '../../interface';
import type { CombinedSelection } from '../../managers';
import type { ICell, IInnerCell } from '../../renderers/cell-renderer/interface';
import { CellType } from '../../renderers/cell-renderer/interface';
import { isPrintableKey } from '../../utils';
import { BooleanEditor } from './BooleanEditor';
import { RatingEditor } from './RatingEditor';
import { SelectEditor } from './SelectEditor';
import { TextEditor } from './TextEditor';

export interface IEditorContainerProps
  extends Pick<
    IInteractionLayerProps,
    | 'theme'
    | 'coordInstance'
    | 'scrollToItem'
    | 'getCellContent'
    | 'onCopy'
    | 'onPaste'
    | 'onDelete'
    | 'onRowAppend'
    | 'onRowExpand'
  > {
  isEditing?: boolean;
  scrollState: IScrollState;
  activeCell: ICellItem | null;
  selection: CombinedSelection;
  activeCellBound: IActiveCellBound | null;
  setActiveCell: React.Dispatch<React.SetStateAction<ICellItem | null>>;
  setSelection: React.Dispatch<React.SetStateAction<CombinedSelection>>;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onChange?: (cell: ICellItem, cellValue: IInnerCell) => void;
}

export interface IEditorRef<T extends IInnerCell = IInnerCell> {
  focus?: () => void;
  setValue?: (data: T['data']) => void;
  saveValue?: () => void;
}

export interface IEditorProps<T extends IInnerCell = IInnerCell> {
  cell: T;
  rect: IRectangle;
  style?: CSSProperties;
  isEditing?: boolean;
  setEditing?: React.Dispatch<React.SetStateAction<boolean>>;
  onChange?: (value: unknown) => void;
}

export interface IEditorContainerRef {
  focus?: () => void;
  saveValue?: () => void;
}

const NO_EDITING_CELL_TYPES = new Set([CellType.Boolean, CellType.Rating]);

const getInputStyle = (cellType: CellType, theme: IGridTheme): CSSProperties => {
  return {
    border: `2px solid ${theme.cellLineColorActived}`,
    boxShadow: 'none',
  };
};

export const EditorContainerBase: ForwardRefRenderFunction<
  IEditorContainerRef,
  IEditorContainerProps
> = (props, ref) => {
  const {
    theme,
    isEditing,
    coordInstance,
    scrollState,
    activeCell,
    selection,
    activeCellBound,
    scrollToItem,
    onCopy,
    onPaste,
    onChange,
    onDelete,
    onRowAppend,
    onRowExpand,
    setEditing,
    setActiveCell,
    setSelection,
    getCellContent,
  } = props;
  const { scrollLeft, scrollTop } = scrollState;
  const [columnIndex, rowIndex] = activeCell ?? [-1, -1];
  const cellContent = useMemo(
    () => getCellContent([columnIndex, rowIndex]) as IInnerCell,
    [columnIndex, getCellContent, rowIndex]
  );
  const { type: cellType, readonly } = cellContent;
  const editingEnable = !readonly && isEditing && activeCell;
  const width = coordInstance.getColumnWidth(columnIndex);
  const height = activeCellBound?.height ?? coordInstance.getRowHeight(rowIndex);
  const editorRef = useRef<IEditorRef | null>(null);
  const defaultFocusRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus?.(),
    saveValue: () => editorRef.current?.saveValue?.(),
  }));

  useEffect(() => {
    if ((cellContent as ICell).type === CellType.Loading) return;
    if (!activeCell) return;
    editorRef.current?.setValue?.(cellContent.data);
    requestAnimationFrame(() => (editorRef.current || defaultFocusRef.current)?.focus?.());
  }, [cellContent, activeCell, isEditing]);

  useKeyboardSelection({
    isEditing,
    activeCell,
    selection,
    coordInstance,
    scrollToItem,
    onCopy,
    onDelete,
    onRowAppend,
    onRowExpand,
    setEditing,
    setActiveCell,
    setSelection,
    editorRef,
  });

  const editorStyle = useMemo(
    () =>
      (editingEnable
        ? { pointerEvents: 'auto', minWidth: width, minHeight: height }
        : { pointerEvents: 'none', opacity: 0, width: 0, height: 0 }) as React.CSSProperties,
    [editingEnable, height, width]
  );

  const rect = useMemo(() => {
    const { rowInitSize, columnInitSize, containerWidth, containerHeight } = coordInstance;
    const x = clamp(
      coordInstance.getColumnRelativeOffset(columnIndex, scrollLeft),
      columnInitSize,
      containerWidth - width
    );
    const y = clamp(
      coordInstance.getRowOffset(rowIndex) - scrollTop,
      rowInitSize,
      containerHeight - height
    );
    return {
      x,
      y,
      width,
      height,
    };
  }, [coordInstance, rowIndex, columnIndex, width, height, scrollLeft, scrollTop]);

  const EditorRenderer = useMemo(() => {
    if (readonly) return null;

    const onChangeInner = (value: unknown) => {
      onChange?.([columnIndex, rowIndex], {
        ...cellContent,
        data: value,
      } as IInnerCell);
    };

    const { customEditor } = cellContent;

    if (customEditor) {
      return customEditor(
        {
          rect,
          style: editorStyle,
          cell: cellContent as IInnerCell,
          isEditing,
          setEditing,
          onChange: onChangeInner,
        },
        editorRef
      );
    }

    switch (cellType) {
      case CellType.Text:
      case CellType.Link:
      case CellType.Number: {
        const inputStyle = getInputStyle(cellType, theme);

        return (
          <TextEditor
            ref={editorRef}
            cell={cellContent}
            rect={rect}
            style={{
              ...editorStyle,
              ...inputStyle,
            }}
            isEditing={isEditing}
            onChange={onChangeInner}
          />
        );
      }
      case CellType.Boolean:
        return (
          <BooleanEditor ref={editorRef} rect={rect} cell={cellContent} onChange={onChangeInner} />
        );
      case CellType.Rating:
        return (
          <RatingEditor ref={editorRef} rect={rect} cell={cellContent} onChange={onChangeInner} />
        );
      case CellType.Select:
        return (
          <SelectEditor
            ref={editorRef}
            rect={rect}
            cell={cellContent}
            style={editorStyle}
            isEditing={isEditing}
            setEditing={setEditing}
            onChange={onChangeInner}
          />
        );
      default:
        return null;
    }
  }, [
    rect,
    theme,
    readonly,
    cellType,
    cellContent,
    rowIndex,
    columnIndex,
    isEditing,
    editorStyle,
    onChange,
    setEditing,
  ]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell || isEditing) return;
    if (!isPrintableKey(event.nativeEvent)) return;
    if (NO_EDITING_CELL_TYPES.has(cellType)) return;
    setEditing(true);
    editorRef.current?.setValue?.(null);
  };

  const onPasteInner = (e: React.ClipboardEvent) => {
    if (!activeCell || isEditing) return;
    onPaste?.(selection, e);
  };

  return (
    <div className="click-outside-ignore pointer-events-none absolute left-0 top-0">
      <div
        className="absolute z-10"
        style={{ minWidth: width, minHeight: height, top: rect.y, left: rect.x }}
        onKeyDown={onKeyDown}
        onPaste={onPasteInner}
      >
        {EditorRenderer}
        <input className="opacity-0" ref={defaultFocusRef} />
      </div>
    </div>
  );
};

export const EditorContainer = forwardRef(EditorContainerBase);
