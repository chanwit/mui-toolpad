import {
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  List,
  ListItem,
} from '@mui/material';
import React from 'react';
import Editor from '@monaco-editor/react';
import { PropValueType, PropValueTypes } from '@mui/studio-core';
import type * as monacoEditor from 'monaco-editor';
import CloseIcon from '@mui/icons-material/Close';
import useLatest from '../../../utils/useLatest';
import { useDom, useDomApi } from '../../DomProvider';
import { usePageEditorState } from './PageEditorProvider';
import { ExactEntriesOf, WithControlledProp } from '../../../utils/types';
import { omit, update } from '../../../utils/immutability';
import * as studioDom from '../../../studioDom';
import { NodeId, StudioBindable } from '../../../types';
import { BindingEditor } from './BindingEditor';

const DERIVED_STATE_PARAMS = 'StudioDerivedStateParams';
const DERIVED_STATE_RESULT = 'StudioDerivedStateResult';

interface EditDerivedStateDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
}

function tsTypeForPropValueType(propValueType: PropValueType): string {
  switch (propValueType.type) {
    case 'string': {
      if (propValueType.enum) {
        return propValueType.enum.map((value) => JSON.stringify(value)).join(' | ');
      }
      return 'string';
    }
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array': {
      // TODO: use something like https://www.npmjs.com/package/json-schema-to-typescript
      // to generate types from a provided schema in [propValueType.schema]
      return `any[]`;
    }
    case 'object': {
      return 'any';
    }
    default:
      throw new Error(`Unsupported argtype "${propValueType.type}"`);
  }
}

interface PropValueTypeSelectorProps extends WithControlledProp<PropValueType> {
  disabled?: boolean;
}

function PropValueTypeSelector({ value, onChange, disabled }: PropValueTypeSelectorProps) {
  return (
    <FormControl size="small">
      <InputLabel id="select-connection-type">Type</InputLabel>
      <Select
        labelId="select-connection-type"
        disabled={disabled}
        size="small"
        value={value.type}
        label="Type"
        onChange={(event) => onChange({ type: event.target.value as PropValueType['type'] })}
      >
        <MenuItem value="string">string</MenuItem>
        <MenuItem value="number">number</MenuItem>
        <MenuItem value="boolean">boolean</MenuItem>
      </Select>
    </FormControl>
  );
}

interface StudioNodePropsEditorProps<P>
  extends WithControlledProp<PropValueTypes<keyof P & string>, 'argTypes'> {
  nodeId: NodeId;
}

function StudioNodePropsEditor<P>({
  nodeId,
  argTypes,
  onArgTypesChange,
}: StudioNodePropsEditorProps<P>) {
  const dom = useDom();
  const domApi = useDomApi();

  const node = studioDom.getNode(dom, nodeId);
  studioDom.assertIsDerivedState<P>(node);

  const handlePropValueChange = React.useCallback(
    (param: keyof P & string) => (newValue: StudioBindable<any> | null) => {
      if (newValue) {
        domApi.setNodePropsValue(node, 'params', param, newValue);
      }
    },
    [domApi, node],
  );

  const handlePropTypeChange = React.useCallback(
    (param: keyof P & string) => (newPropType: PropValueType) => {
      onArgTypesChange(
        update(argTypes, {
          [param]: newPropType,
        } as Partial<PropValueTypes<keyof P & string>>),
      );
    },
    [onArgTypesChange, argTypes],
  );

  const handlePropRemove = React.useCallback(
    (param: keyof P & string) => () => {
      domApi.setNodePropsValue(node, 'params', param, null);
      onArgTypesChange(omit(argTypes, param) as PropValueTypes<keyof P & string>);
    },
    [domApi, node, onArgTypesChange, argTypes],
  );

  return (
    <Stack>
      {(Object.entries(argTypes) as ExactEntriesOf<PropValueTypes<keyof P & string>>).map(
        ([propName, propType]) => {
          if (!propType) {
            return null;
          }
          const propValue: StudioBindable<any> | null = node.params[propName] ?? null;
          const isBound = !!propValue;
          return (
            <Stack key={propName} direction="row" alignItems="center" gap={1}>
              {propName}:
              <PropValueTypeSelector
                value={propType}
                onChange={handlePropTypeChange(propName)}
                disabled={isBound}
              />
              <BindingEditor
                nodeId={nodeId}
                prop={propName}
                propType={propType}
                value={propValue}
                onChange={handlePropValueChange(propName)}
              />
              <IconButton onClick={handlePropRemove(propName)}>
                <CloseIcon />
              </IconButton>
            </Stack>
          );
        },
      )}
    </Stack>
  );
}

function EditDerivedStateDialog<P>({ nodeId, open, onClose }: EditDerivedStateDialogProps) {
  const monacoRef = React.useRef<typeof monacoEditor>();

  const dom = useDom();
  const domApi = useDomApi();
  const value = studioDom.getNode(dom, nodeId);
  studioDom.assertIsDerivedState<P>(value);

  const [codeInput, setCodeInput] = React.useState(value.code);
  React.useEffect(() => setCodeInput(value.code), [value.code]);

  const libSource = React.useMemo(() => {
    const args = (Object.entries(value.argTypes) as ExactEntriesOf<PropValueTypes>).map(
      ([propName, paramType]) => {
        const tsType = paramType ? tsTypeForPropValueType(paramType) : 'unknown';
        return `${propName}: ${tsType};`;
      },
    );

    return `
      declare interface ${DERIVED_STATE_PARAMS} {
        ${args.join('\n')}
      }

      declare type ${DERIVED_STATE_RESULT} = ${tsTypeForPropValueType(value.returnType)}
    `;
  }, [value.argTypes, value.returnType]);

  const libSourceDisposable = React.useRef<monacoEditor.IDisposable>();
  const setLibSource = React.useCallback(() => {
    libSourceDisposable.current?.dispose();
    if (monacoRef.current) {
      libSourceDisposable.current =
        monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
          libSource,
          'file:///node_modules/@mui/studio/index.d.ts',
        );
    }
  }, [libSource]);
  React.useEffect(() => () => libSourceDisposable.current?.dispose(), []);

  React.useEffect(() => setLibSource(), [setLibSource]);

  const HandleEditorMount = React.useCallback(
    (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor) => {
      monacoRef.current = monaco;

      editor.updateOptions({
        minimap: { enabled: false },
        accessibilitySupport: 'off',
      });

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      setLibSource();
    },
    [setLibSource],
  );

  const [newPropName, setnewPropName] = React.useState('');
  const handleAddProp = React.useCallback(() => {
    domApi.setNodeAttribute(
      value,
      'argTypes',
      update(value.argTypes, {
        [newPropName]: { type: 'string' },
      }),
    );
    setnewPropName('');
  }, [domApi, value, newPropName]);

  const handlePropTypesChange = React.useCallback(
    (newPropTypes: PropValueTypes) => {
      domApi.setNodeAttribute(value, 'argTypes', newPropTypes);
    },
    [domApi, value],
  );

  const handleReturnTypeChange = React.useCallback(
    (newReturnType: PropValueType) => {
      domApi.setNodeAttribute(value, 'returnType', newReturnType);
    },
    [domApi, value],
  );

  const handleSaveCode = React.useCallback(() => {
    domApi.setNodeAttribute(value, 'code', codeInput);
  }, [domApi, value, codeInput]);

  return (
    <Dialog fullWidth maxWidth="lg" open={open} onClose={onClose}>
      <DialogTitle>Edit Derived State ({nodeId})</DialogTitle>
      <DialogContent>
        <Stack gap={1} my={1}>
          <StudioNodePropsEditor
            nodeId={value.id}
            argTypes={value.argTypes}
            onArgTypesChange={handlePropTypesChange}
          />
          <Stack direction="row" alignItems="center" gap={1}>
            <TextField
              value={newPropName}
              onChange={(event) => setnewPropName(event.target.value)}
              size="small"
            />
            <Button
              disabled={!newPropName || Object.keys(value.argTypes).includes(newPropName)}
              onClick={handleAddProp}
            >
              Add prop
            </Button>
          </Stack>

          <Stack direction="row" alignItems="center" gap={1}>
            State type:
            <PropValueTypeSelector value={value.returnType} onChange={handleReturnTypeChange} />
          </Stack>
        </Stack>
        <Editor
          height="200px"
          value={codeInput}
          onChange={(newValue = '') => setCodeInput(newValue)}
          path="./component.tsx"
          language="typescript"
          onMount={HandleEditorMount}
        />
        <Button disabled={codeInput === value.code} onClick={handleSaveCode}>
          Save Code
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function DerivedStateEditor() {
  const dom = useDom();
  const state = usePageEditorState();
  const domApi = useDomApi();

  const [editedStateNode, setEditedState] = React.useState<NodeId | null>(null);
  const handleEditStateDialogClose = React.useCallback(() => setEditedState(null), []);

  const page = studioDom.getNode(dom, state.nodeId);
  studioDom.assertIsPage(page);
  const { derivedStates = [] } = studioDom.getChildNodes(dom, page);

  const handleCreate = React.useCallback(() => {
    const stateNode = studioDom.createNode(dom, 'derivedState', {
      argTypes: {},
      returnType: {
        type: 'string',
      },
      params: {},
      code: `/**
 * TODO: comment explaining how to derive state...
 */

export default function getDerivedState (params: ${DERIVED_STATE_PARAMS}): ${DERIVED_STATE_RESULT} {
  return 'Hello World!';
}\n`,
    });
    domApi.addNode(stateNode, page, 'derivedStates');
    setEditedState(stateNode.id);
  }, [dom, domApi, page]);

  // To keep it around during closing animation
  const lastEditedStateNode = useLatest(editedStateNode);
  return (
    <Stack spacing={1} alignItems="start">
      <Button color="inherit" onClick={handleCreate}>
        create derived state
      </Button>
      <List>
        {derivedStates.map((stateNode) => {
          return (
            <ListItem key={stateNode.id} button onClick={() => setEditedState(stateNode.id)}>
              {stateNode.name}
            </ListItem>
          );
        })}
      </List>
      {lastEditedStateNode ? (
        <EditDerivedStateDialog
          nodeId={lastEditedStateNode}
          open={!!editedStateNode}
          onClose={handleEditStateDialogClose}
        />
      ) : null}
    </Stack>
  );
}