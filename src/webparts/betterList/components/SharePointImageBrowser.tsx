import * as React from 'react';
import {
  Button,
  Select,
  Spinner,
  Text,
  makeStyles,
  shorthands,
  tokens
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  ArrowUploadRegular,
  DismissRegular,
  FolderRegular,
  ImageRegular
} from '@fluentui/react-icons';

import type {
  ISharePointImageAsset,
  ISharePointImageAssetProvider,
  ISharePointImageFolderContents,
  ISharePointImageLibrary
} from '../services';

export interface ISharePointImageBrowserProps {
  provider?: ISharePointImageAssetProvider;
  onSelect: (url: string) => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
    marginTop: '16px'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  help: {
    color: tokens.colorNeutralForeground3
  },
  browser: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
    minHeight: '260px',
    maxHeight: '340px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding('10px')
  },
  browserHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px'
  },
  library: {
    minWidth: '0',
    flexGrow: 1
  },
  path: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '6px',
    minHeight: '32px',
    color: tokens.colorNeutralForeground2
  },
  pathText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  results: {
    minHeight: '0',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
    gap: '8px'
  },
  tile: {
    minHeight: '94px',
    height: 'auto',
    ...shorthands.padding('8px'),
    '& > span': {
      display: 'flex',
      flexDirection: 'column',
      rowGap: '6px',
      minWidth: '0'
    },
    contentVisibility: 'auto'
  },
  thumbnail: {
    width: '56px',
    height: '48px',
    objectFit: 'contain',
    ...shorthands.borderRadius(tokens.borderRadiusSmall)
  },
  folderIcon: {
    width: '34px',
    height: '34px',
    color: tokens.colorBrandForeground1
  },
  tileLabel: {
    display: 'block',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  state: {
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '8px',
    color: tokens.colorNeutralForeground3,
    textAlign: 'center'
  },
  hiddenInput: {
    display: 'none'
  },
  error: {
    color: tokens.colorPaletteRedForeground1
  }
});

export const SharePointImageBrowser: React.FunctionComponent<ISharePointImageBrowserProps> = ({
  provider,
  onSelect
}) => {
  const classes = useStyles();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [browserOpen, setBrowserOpen] = React.useState(false);
  const [libraries, setLibraries] = React.useState<readonly ISharePointImageLibrary[]>([]);
  const [library, setLibrary] = React.useState<ISharePointImageLibrary>();
  const [contents, setContents] = React.useState<ISharePointImageFolderContents>();
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [retryFolderUrl, setRetryFolderUrl] = React.useState<string>();
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [messageIsError, setMessageIsError] = React.useState(false);

  const loadFolder = React.useCallback(async (serverRelativeUrl: string): Promise<void> => {
    if (!provider) return;
    setStatus('loading');
    setRetryFolderUrl(serverRelativeUrl);
    setMessage('');
    setMessageIsError(false);
    try {
      const next = await provider.browseFolder(serverRelativeUrl);
      setContents(next);
      setRetryFolderUrl(undefined);
      setStatus('ready');
    } catch (error) {
      setMessage(errorMessage(error, 'This SharePoint folder could not be opened.'));
      setMessageIsError(true);
      setStatus('error');
    }
  }, [provider]);

  const openBrowser = React.useCallback(async (): Promise<void> => {
    if (!provider) return;
    setBrowserOpen(true);
    setStatus('loading');
    setRetryFolderUrl(undefined);
    setMessage('');
    setMessageIsError(false);
    try {
      const nextLibraries = await provider.discoverLibraries();
      setLibraries(nextLibraries);
      const preferred = nextLibraries.find((entry) => entry.title.toLocaleLowerCase() === 'site assets') ?? nextLibraries[0];
      setLibrary(preferred);
      if (preferred) {
        await loadFolder(preferred.serverRelativeUrl);
      } else {
        setContents(undefined);
        setStatus('ready');
      }
    } catch (error) {
      setMessage(errorMessage(error, 'SharePoint image libraries could not be loaded.'));
      setMessageIsError(true);
      setStatus('error');
    }
  }, [loadFolder, provider]);

  const upload = React.useCallback(async (file: File): Promise<void> => {
    if (!provider) return;
    setUploading(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const asset = await provider.uploadImage(file);
      onSelect(asset.absoluteUrl);
      setBrowserOpen(false);
      setMessage(`${asset.name} was uploaded to Site Assets and selected.`);
    } catch (error) {
      setMessage(errorMessage(error, 'The image could not be uploaded to SharePoint.'));
      setMessageIsError(true);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onSelect, provider]);

  const parentUrl = library && contents
    ? parentFolderUrl(library.serverRelativeUrl, contents.serverRelativeUrl)
    : undefined;

  return (
    <div className={classes.root}>
      <div className={classes.actions}>
        <Button
          appearance="secondary"
          disabled={!provider || uploading}
          icon={<ImageRegular aria-hidden="true" />}
          onClick={() => { openBrowser().catch(() => undefined); }}
        >
          Browse SharePoint
        </Button>
        <Button
          appearance="secondary"
          disabled={!provider || uploading}
          icon={uploading ? <Spinner size="tiny" /> : <ArrowUploadRegular aria-hidden="true" />}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading' : 'Upload image'}
        </Button>
        <input
          accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
          aria-label="Upload an image to SharePoint"
          className={classes.hiddenInput}
          disabled={!provider || uploading}
          ref={inputRef}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) upload(file).catch(() => undefined);
          }}
        />
      </div>
      <Text className={classes.help} size={200}>
        {provider
          ? 'Browse this site or upload a PNG, JPEG, GIF, or WebP image to Site Assets/Better List/Group Icons.'
          : 'SharePoint browsing and upload are available when this web part runs on a SharePoint page.'}
      </Text>
      {message ? (
        <Text aria-live="polite" className={messageIsError ? classes.error : undefined} size={200}>
          {message}
        </Text>
      ) : null}
      {browserOpen ? (
        <div aria-label="Browse SharePoint images" className={classes.browser}>
          <div className={classes.browserHeader}>
            <Select
              aria-label="SharePoint image library"
              className={classes.library}
              disabled={status === 'loading'}
              value={library?.serverRelativeUrl ?? ''}
              onChange={(event) => {
                const next = libraries.find((entry) => entry.serverRelativeUrl === event.currentTarget.value);
                setLibrary(next);
                if (next) loadFolder(next.serverRelativeUrl).catch(() => undefined);
              }}
            >
              {libraries.map((entry) => (
                <option key={entry.id} value={entry.serverRelativeUrl}>{entry.title}</option>
              ))}
            </Select>
            <Button
              appearance="subtle"
              aria-label="Close SharePoint browser"
              icon={<DismissRegular aria-hidden="true" />}
              onClick={() => setBrowserOpen(false)}
            />
          </div>
          {contents ? (
            <div className={classes.path}>
              <Button
                appearance="subtle"
                aria-label="Go to parent folder"
                disabled={!parentUrl || status === 'loading'}
                icon={<ArrowLeftRegular aria-hidden="true" />}
                size="small"
                onClick={() => { if (parentUrl) loadFolder(parentUrl).catch(() => undefined); }}
              />
              <Text className={classes.pathText} title={displayPath(library, contents.serverRelativeUrl)}>
                {displayPath(library, contents.serverRelativeUrl)}
              </Text>
            </div>
          ) : null}
          <div className={classes.results}>
            {status === 'loading' ? (
              <div className={classes.state} role="status"><Spinner label="Loading SharePoint images" /></div>
            ) : status === 'error' ? (
              <div className={classes.state} role="alert">
                <Text>{message}</Text>
                <Button onClick={() => {
                  const request = retryFolderUrl ? loadFolder(retryFolderUrl) : openBrowser();
                  request.catch(() => undefined);
                }}>
                  Retry
                </Button>
              </div>
            ) : contents && (contents.folders.length || contents.images.length) ? (
              <div className={classes.grid}>
                {contents.folders.map((folder) => (
                  <Button
                    appearance="subtle"
                    aria-label={`Open ${folder.name} folder`}
                    className={classes.tile}
                    key={`folder:${folder.serverRelativeUrl}`}
                    onClick={() => { loadFolder(folder.serverRelativeUrl).catch(() => undefined); }}
                  >
                    <FolderRegular aria-hidden="true" className={classes.folderIcon} />
                    <span className={classes.tileLabel} title={folder.name}>{folder.name}</span>
                  </Button>
                ))}
                {contents.images.map((asset) => (
                  <ImageTile asset={asset} className={classes.tile} imageClassName={classes.thumbnail} key={asset.serverRelativeUrl} labelClassName={classes.tileLabel} onSelect={onSelect} close={() => setBrowserOpen(false)} />
                ))}
              </div>
            ) : (
              <div className={classes.state} role="status">No supported images are in this folder.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

function ImageTile({ asset, className, imageClassName, labelClassName, onSelect, close }: {
  asset: ISharePointImageAsset;
  className: string;
  imageClassName: string;
  labelClassName: string;
  onSelect: (url: string) => void;
  close: () => void;
}): React.ReactElement {
  return (
    <Button
      appearance="subtle"
      aria-label={`Select ${asset.name}`}
      className={className}
      onClick={() => {
        onSelect(asset.absoluteUrl);
        close();
      }}
    >
      <img alt="" className={imageClassName} decoding="async" loading="lazy" src={asset.absoluteUrl} />
      <span className={labelClassName} title={asset.name}>{asset.name}</span>
    </Button>
  );
}

function displayPath(library: ISharePointImageLibrary | undefined, folderUrl: string): string {
  if (!library) return folderUrl;
  const relative = folderUrl.slice(library.serverRelativeUrl.length).replace(/^\/+/, '');
  return relative ? `${library.title} / ${relative.split('/').map(decodePathPart).join(' / ')}` : library.title;
}

function parentFolderUrl(libraryRoot: string, folderUrl: string): string | undefined {
  const normalizedRoot = libraryRoot.replace(/\/+$/, '');
  const normalizedFolder = folderUrl.replace(/\/+$/, '');
  if (normalizedFolder.toLocaleLowerCase() === normalizedRoot.toLocaleLowerCase()) return undefined;
  const parent = normalizedFolder.slice(0, normalizedFolder.lastIndexOf('/'));
  return parent.length >= normalizedRoot.length ? parent : normalizedRoot;
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
