import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  PortalMountNodeProvider,
  SelectTabData,
  SelectTabEvent,
  Spinner,
  Tab,
  TabList,
  Text,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  useFluent
} from '@fluentui/react-components';
import { ImageRegular, SearchRegular } from '@fluentui/react-icons';

import {
  BetterListGroupIconLibrary,
  BetterListGroupIconOverride,
  betterListFluentSurfaceClassName,
  ensureBetterListRuntimeStyles,
  getBetterListPortalMountNode,
  normalizeBetterListGroupImageUrl
} from '../../../shared';
import {
  BetterListGroupIconVisual
} from './GroupIconCatalog';
import {
  IBetterListGroupIconCatalogEntry,
  loadBetterListGroupIconPickerCatalog
} from './GroupIconPickerCatalog';
import type { ISharePointImageAssetProvider } from '../services';
import { GroupIconColorField } from './GroupIconColorField';
import { SharePointImageBrowser } from './SharePointImageBrowser';

type PickerView = BetterListGroupIconLibrary | 'image';

export interface IGroupIconPickerDialogProps {
  current: BetterListGroupIconOverride | undefined;
  defaultColor?: string;
  groupTitle: string;
  open: boolean;
  imageAssetProvider?: ISharePointImageAssetProvider;
  onApply: (override: BetterListGroupIconOverride | undefined) => void;
  onOpenChange: (open: boolean) => void;
  showAutomaticAction?: boolean;
}

const useStyles = makeStyles({
  surface: {
    width: 'min(760px, calc(100vw - 32px))',
    maxWidth: '760px',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'hidden'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
    minHeight: '0',
    overflowY: 'auto',
    overscrollBehavior: 'contain'
  },
  search: {
    width: '100%'
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: '12px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
    gap: '8px'
  },
  results: {
    minHeight: '240px',
    maxHeight: '340px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    ...shorthands.padding('2px')
  },
  tile: {
    width: '100%',
    minWidth: 0,
    minHeight: '104px',
    height: '104px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '8px',
    overflow: 'hidden',
    fontWeight: tokens.fontWeightRegular,
    ...shorthands.padding('8px')
  },
  tileSelected: {
    outlineColor: tokens.colorBrandStroke1,
    outlineOffset: '-2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    backgroundColor: tokens.colorBrandBackground2
  },
  tileIconFrame: {
    width: '32px',
    height: '32px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tileIcon: {
    width: '100%',
    height: '100%',
    display: 'block',
    flexShrink: 0,
    fontSize: '32px'
  },
  tileLabel: {
    width: '100%',
    minWidth: 0,
    maxHeight: '32px',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
    textAlign: 'center',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase200
  },
  preview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '112px',
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2)
  },
  previewIcon: {
    width: '64px',
    height: '64px',
    fontSize: '64px',
    objectFit: 'contain'
  },
  colorHelp: {
    color: tokens.colorNeutralForeground3
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    ...shorthands.padding('32px')
  },
  loading: {
    minHeight: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageHelp: {
    color: tokens.colorNeutralForeground3,
    marginTop: '4px'
  },
  actionStart: {
    marginRight: 'auto'
  }
});

export const GroupIconPickerDialog: React.FunctionComponent<IGroupIconPickerDialogProps> = ({
  current,
  defaultColor,
  groupTitle,
  open,
  imageAssetProvider,
  onApply,
  onOpenChange,
  showAutomaticAction = true
}) => {
  const classes = useStyles();
  const { targetDocument } = useFluent();
  const portalMountNode = getBetterListPortalMountNode(targetDocument);
  const [view, setView] = React.useState<PickerView>('solar-duotone');
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState<BetterListGroupIconOverride | undefined>(current);
  const [draftColor, setDraftColor] = React.useState<string | undefined>(
    current?.kind === 'icon' ? current.color : undefined
  );
  const [imageUrl, setImageUrl] = React.useState('');
  const [catalog, setCatalog] = React.useState<readonly IBetterListGroupIconCatalogEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [catalogAttempt, setCatalogAttempt] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(80);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (open && targetDocument) {
      ensureBetterListRuntimeStyles(targetDocument);
    }
  }, [open, targetDocument]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(current);
    setDraftColor(current?.kind === 'icon' ? current.color : undefined);
    setQuery('');
    setImageUrl(current?.kind === 'image' ? current.url : '');
    setView(current?.kind === 'image' ? 'image' : current?.kind === 'icon' ? current.library : 'solar-duotone');
  }, [current, open]);

  React.useEffect(() => {
    if (!open || view === 'image') {
      setCatalogStatus('idle');
      return;
    }
    let active = true;
    setCatalog([]);
    setCatalogStatus('loading');
    loadBetterListGroupIconPickerCatalog(view)
      .then((entries) => {
        if (!active) return;
        setCatalog(entries);
        setCatalogStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setCatalogStatus('error');
      });
    return () => { active = false; };
  }, [catalogAttempt, open, view]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = React.useMemo(
    () =>
      catalog.filter(
        (entry) =>
          !normalizedQuery || entry.searchText.includes(normalizedQuery)
      ),
    [catalog, normalizedQuery]
  );
  const visibleResults = results.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(80);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  }, [normalizedQuery, view]);
  const normalizedImageUrl = view === 'image' ? normalizeBetterListGroupImageUrl(imageUrl) : undefined;
  const activeCatalogIcon =
    draft?.kind === 'icon' && draft.library === view ? draft : undefined;
  const previewOverride =
    view === 'image' && normalizedImageUrl
      ? ({ kind: 'image', url: normalizedImageUrl } as const)
      : activeCatalogIcon;
  const canApply = view === 'image' ? Boolean(normalizedImageUrl) : Boolean(activeCatalogIcon);

  const updateDraftColor = (color: string | undefined): void => {
    setDraftColor(color);
    setDraft((currentDraft) => {
      if (currentDraft?.kind !== 'icon') {
        return currentDraft;
      }
      return {
        kind: 'icon',
        library: currentDraft.library,
        name: currentDraft.name,
        ...(color ? { color } : {})
      };
    });
  };

  const apply = (): void => {
    if (view === 'image' && normalizedImageUrl) {
      onApply({ kind: 'image', url: normalizedImageUrl });
    } else if (activeCatalogIcon) {
      onApply(activeCatalogIcon);
    } else {
      return;
    }
    onOpenChange(false);
  };

  return (
    <PortalMountNodeProvider value={portalMountNode}>
    <Dialog modalType="modal" open={open} onOpenChange={(_event, data) => onOpenChange(data.open)}>
      <DialogSurface className={mergeClasses(classes.surface, betterListFluentSurfaceClassName)}>
        <DialogBody>
          <DialogTitle>{`Icon for “${groupTitle}”`}</DialogTitle>
          <DialogContent className={classes.content}>
            <div className={classes.preview} aria-label="Selected icon preview">
              {previewOverride ? (
                <BetterListGroupIconVisual
                  className={classes.previewIcon}
                  defaultColor={defaultColor}
                  override={previewOverride}
                />
              ) : (
                <ImageRegular className={classes.previewIcon} aria-hidden="true" />
              )}
            </div>
            {view === 'fluent-color' ? (
              <Text className={classes.colorHelp} size={200}>
                Fluent color icons keep their built-in palette.
              </Text>
            ) : view !== 'image' ? (
              <GroupIconColorField
                fallbackColor={defaultColor}
                value={draftColor}
                onChange={updateDraftColor}
              />
            ) : null}
            <TabList
              aria-label="Icon source"
              selectedValue={view}
              onTabSelect={(_event: SelectTabEvent, data: SelectTabData) => setView(data.value as PickerView)}
            >
              <Tab value="solar-duotone">Solar duotone</Tab>
              <Tab value="fluent">Fluent</Tab>
              <Tab value="fluent-color">Fluent color</Tab>
              <Tab value="image">Image</Tab>
            </TabList>
            {view === 'image' ? (
              <div>
                <Field
                  label="Image URL"
                  validationMessage={imageUrl && !normalizedImageUrl ? 'Use an HTTPS or SharePoint-relative image URL.' : undefined}
                  validationState={imageUrl && !normalizedImageUrl ? 'error' : 'none'}
                >
                  <Input
                    value={imageUrl}
                    placeholder="/sites/example/SiteAssets/group-icon.png"
                    onChange={(event) => setImageUrl(event.currentTarget.value)}
                  />
                </Field>
                <div className={classes.imageHelp}>Use an HTTPS URL or a path beginning with / for a SharePoint-hosted image.</div>
                <SharePointImageBrowser provider={imageAssetProvider} onSelect={setImageUrl} />
              </div>
            ) : (
              <>
                <Input
                  aria-label="Search icons"
                  className={classes.search}
                  contentBefore={<SearchRegular aria-hidden="true" />}
                  placeholder="Search icons"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
                <div className={classes.resultsHeader}>
                  <Text weight="semibold">Choose an icon</Text>
                  <Text aria-live="polite" size={200}>
                    {catalogStatus === 'ready'
                      ? `Showing ${visibleResults.length} of ${results.length} icons`
                      : catalogStatus === 'loading' ? 'Loading icons' : ''}
                  </Text>
                </div>
                {catalogStatus === 'loading' ? (
                  <div className={classes.loading} role="status">
                    <Spinner label={`Loading ${libraryLabel(view)} icons`} />
                  </div>
                ) : catalogStatus === 'error' ? (
                  <div className={classes.empty} role="alert">
                    <Text block>Icons could not be loaded.</Text>
                    <Button appearance="secondary" onClick={() => setCatalogAttempt((value) => value + 1)}>Retry</Button>
                  </div>
                ) : results.length ? (
                  <div
                    aria-label={`${libraryLabel(view)} icons`}
                    className={classes.results}
                    ref={resultsRef}
                    role="group"
                    tabIndex={-1}
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
                        setVisibleCount((count) => Math.min(count + 80, results.length));
                      }
                    }}
                  >
                    <div className={classes.grid}>
                    {visibleResults.map((entry) => {
                      const icon = toOverride(entry, draftColor);
                      const selected = sameCatalogIcon(draft, icon);
                      return (
                        <Button
                          appearance="subtle"
                          aria-label={entry.label}
                          aria-pressed={selected}
                          className={mergeClasses(classes.tile, selected && classes.tileSelected)}
                          key={`${entry.library}:${entry.name}`}
                          title={entry.label}
                          onClick={() => setDraft(icon)}
                        >
                          <span className={classes.tileIconFrame}>
                            <BetterListGroupIconVisual
                              className={classes.tileIcon}
                              defaultColor={defaultColor}
                              fallback={<ImageRegular aria-hidden="true" className={classes.tileIcon} />}
                              override={icon}
                            />
                          </span>
                          <span className={classes.tileLabel}>{entry.label}</span>
                        </Button>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  <div className={classes.empty} role="status">{`No icons match “${query}”.`}</div>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions fluid>
            {showAutomaticAction ? (
              <Button
                appearance="subtle"
                className={classes.actionStart}
                onClick={() => {
                  onApply(undefined);
                  onOpenChange(false);
                }}
              >
                Use automatic icon
              </Button>
            ) : <span className={classes.actionStart} />}
            <Button
              appearance="subtle"
              onClick={() => {
                onApply({ kind: 'none' });
                onOpenChange(false);
              }}
            >
              No icon
            </Button>
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!canApply} onClick={apply}>Apply</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
    </PortalMountNodeProvider>
  );
};

/** Group-neutral alias used by tab and group authoring surfaces. */
export const IconPickerDialog = GroupIconPickerDialog;

function toOverride(
  entry: IBetterListGroupIconCatalogEntry,
  color?: string
): BetterListGroupIconOverride {
  return {
    kind: 'icon',
    library: entry.library,
    name: entry.name,
    ...(entry.library !== 'fluent-color' && color ? { color } : {})
  };
}

function sameCatalogIcon(
  left: BetterListGroupIconOverride | undefined,
  right: BetterListGroupIconOverride
): boolean {
  return Boolean(
    left?.kind === 'icon' &&
      right.kind === 'icon' &&
      left.library === right.library &&
      left.name === right.name
  );
}

function libraryLabel(value: PickerView): string {
  return value === 'solar-duotone' ? 'Solar duotone' : value === 'fluent-color' ? 'Fluent color' : 'Fluent';
}
