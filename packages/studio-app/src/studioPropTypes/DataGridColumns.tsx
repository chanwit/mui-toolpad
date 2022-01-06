import * as React from 'react';
import type { PropTypeDefinition } from '../types';

const DataGridRows: PropTypeDefinition<string[]> = {
  Editor: () => <React.Fragment>Columns</React.Fragment>,
};

export default DataGridRows;