export interface Tag {
  id: string;
  name: string;
}

export interface Resource {
  id: string;
  type: 'note' | 'file';
  title: string;
  content?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface AuthStatus {
  isSetup: boolean;
}
