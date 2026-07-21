export interface ISharePointImageLibrary {
  id: string;
  title: string;
  serverRelativeUrl: string;
}

export interface ISharePointImageFolder {
  name: string;
  serverRelativeUrl: string;
}

export interface ISharePointImageAsset {
  name: string;
  serverRelativeUrl: string;
  absoluteUrl: string;
  size?: number;
  modified?: string;
}

export interface ISharePointImageFolderContents {
  serverRelativeUrl: string;
  folders: readonly ISharePointImageFolder[];
  images: readonly ISharePointImageAsset[];
}

export interface ISharePointImageAssetProvider {
  discoverLibraries(): Promise<readonly ISharePointImageLibrary[]>;
  browseFolder(serverRelativeUrl: string): Promise<ISharePointImageFolderContents>;
  uploadImage(file: File): Promise<ISharePointImageAsset>;
}
