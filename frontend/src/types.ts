export interface Note {
  id: string;
  title: string;
  content?: string;
  preview?: string;
  createdAt?: string;
  updatedAt?: string;
  files?: AttachedFile[];
}

export interface AttachedFile {
  id: string;
  name: string;
}

export interface AuthStatus {
  isSetup: boolean;
}
