export interface MindMapNode {
    id: string;
    label: string;
    parentId: string | null;
    children?: MindMapNode[];
  }
  
  export interface MindMapData {
    nodes: MindMapNode[];
  }
  
  export interface MindMapOptions {
    width: number;
    height: number;
    nodeRadius: number;
    nodeSpacing: number;
  }