import * as React from 'react';
import { Icon as IconifyIcon, IconifyIcon as IconifyIconData } from '@iconify/react/offline';
import {
  AppsListDetailColor,
  AppsListDetailRegular,
  BookOpenColor,
  BookOpenRegular,
  BriefcaseColor,
  BriefcaseRegular,
  BuildingMultipleColor,
  BuildingMultipleRegular,
  CalendarColor,
  CalendarRegular,
  ChatColor,
  DocumentTextColor,
  DocumentTextRegular,
  FluentIcon,
  GlobeColor,
  GlobeRegular,
  HeadsetColor,
  HeadsetRegular,
  HeartColor,
  HeartRegular,
  LightbulbColor,
  LightbulbRegular,
  MailColor,
  MailRegular,
  MegaphoneRegular,
  NewsColor,
  NewsRegular,
  PeopleTeamColor,
  PeopleTeamRegular,
  ShieldColor,
  ShieldRegular,
  WrenchColor,
  WrenchRegular
} from '@fluentui/react-icons';

import {
  BetterListGroupIconOverride,
  IBetterListCatalogGroupIcon
} from '../../../shared';
import { solarGroupIcons } from './SolarGroupIconData';
import { loadBetterListGroupIconData } from './GroupIconDataLoader';

type CatalogIconComponent = React.ComponentType<Record<string, unknown>>;
type SolarElementName = 'circle' | 'ellipse' | 'path';
interface ISolarElementProps {
  clipRule?: 'evenodd' | 'inherit' | 'nonzero';
  cx?: string;
  cy?: string;
  d?: string;
  fill?: string;
  fillRule?: 'evenodd' | 'inherit' | 'nonzero';
  opacity?: string;
  r?: string;
  rx?: string;
  ry?: string;
  stroke?: string;
  strokeLinecap?: 'butt' | 'inherit' | 'round' | 'square';
  strokeWidth?: string;
}
interface ISolarElement {
  name: SolarElementName;
  props: ISolarElementProps;
}

const SOLAR_ELEMENT_PATTERN = /<(circle|ellipse|path)\s+([^>]+)\/>/g;
const SOLAR_ATTRIBUTE_PATTERN = /([a-z-]+)="([^"]*)"/g;
const solarElementCache: Record<string, readonly ISolarElement[]> = {};

const fluentIcons: Readonly<Record<string, FluentIcon>> = {
  'apps-list-detail': AppsListDetailRegular,
  'building-multiple': BuildingMultipleRegular,
  megaphone: MegaphoneRegular,
  'document-text': DocumentTextRegular,
  headset: HeadsetRegular,
  'people-team': PeopleTeamRegular,
  briefcase: BriefcaseRegular,
  calendar: CalendarRegular,
  globe: GlobeRegular,
  heart: HeartRegular,
  lightbulb: LightbulbRegular,
  wrench: WrenchRegular,
  shield: ShieldRegular,
  'book-open': BookOpenRegular,
  mail: MailRegular,
  news: NewsRegular
};

const fluentColorIcons: Readonly<Record<string, FluentIcon>> = {
  'apps-list-detail': AppsListDetailColor,
  'building-multiple': BuildingMultipleColor,
  chat: ChatColor,
  'document-text': DocumentTextColor,
  headset: HeadsetColor,
  'people-team': PeopleTeamColor,
  briefcase: BriefcaseColor,
  calendar: CalendarColor,
  globe: GlobeColor,
  heart: HeartColor,
  lightbulb: LightbulbColor,
  wrench: WrenchColor,
  shield: ShieldColor,
  'book-open': BookOpenColor,
  mail: MailColor,
  news: NewsColor
};

export const BetterListGroupIconVisual: React.FunctionComponent<{
  className?: string;
  defaultColor?: string;
  fallback?: React.ReactNode;
  override: BetterListGroupIconOverride;
}> = ({ className, defaultColor, fallback, override }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [loadedIcon, setLoadedIcon] = React.useState<IconifyIconData>();
  const library = override.kind === 'icon' ? override.library : undefined;
  const name = override.kind === 'icon' ? override.name : undefined;
  const iconColor = override.kind === 'icon' && override.library !== 'fluent-color'
    ? override.color || defaultColor
    : undefined;
  const iconStyle = iconColor
    ? { color: iconColor }
    : undefined;
  const hasCuratedIcon = override.kind === 'icon' && hasCuratedGroupIcon(override);

  React.useEffect(() => setImageFailed(false), [override]);
  React.useEffect(() => {
    let active = true;
    setLoadedIcon(undefined);
    if (!library || !name || hasCuratedIcon) {
      return () => { active = false; };
    }
    loadBetterListGroupIconData(library, name)
      .then((icon) => {
        if (active) setLoadedIcon(icon);
      })
      .catch(() => {
        if (active) setLoadedIcon(undefined);
      });
    return () => { active = false; };
  }, [hasCuratedIcon, library, name]);

  if (override.kind === 'none') {
    return null;
  }
  if (override.kind === 'image') {
    return imageFailed ? (
      <>{fallback}</>
    ) : (
      <img
        alt=""
        className={className}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={override.url}
        onError={() => setImageFailed(true)}
      />
    );
  }
  if (override.library === 'solar-duotone') {
    const curatedSolar = solarGroupIcons[override.name];
    if (curatedSolar) {
      return renderSolarGroupIcon(override.name, className, fallback, iconStyle);
    }
  }
  const Component = getFluentCatalogComponent(override);
  if (Component) {
    return (
    <Component aria-hidden="true" className={className} style={iconStyle} />
    );
  }
  return loadedIcon ? (
    <IconifyIcon aria-hidden="true" className={className} icon={loadedIcon} style={iconStyle} />
  ) : <>{fallback}</>;
};

function hasCuratedGroupIcon(icon: IBetterListCatalogGroupIcon): boolean {
  return icon.library === 'solar-duotone'
    ? Boolean(solarGroupIcons[icon.name])
    : Boolean(getFluentCatalogComponent(icon));
}

function renderSolarGroupIcon(
  name: string,
  className: string | undefined,
  fallback: React.ReactNode,
  style?: React.CSSProperties
): React.ReactElement {
  const icon = solarGroupIcons[name];
  if (!icon) {
    return <>{fallback}</>;
  }
  const elements = solarElementCache[name] || (solarElementCache[name] = parseSolarElements(icon.body));
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={icon.height}
      style={style}
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      width={icon.width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor">
        {elements.map(renderSolarElement)}
      </g>
    </svg>
  );
}

function parseSolarElements(body: string): readonly ISolarElement[] {
  const elements: ISolarElement[] = [];
  SOLAR_ELEMENT_PATTERN.lastIndex = 0;
  let elementMatch: RegExpExecArray | null;
  while ((elementMatch = SOLAR_ELEMENT_PATTERN.exec(body))) {
    const props: ISolarElementProps = {};
    SOLAR_ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch: RegExpExecArray | null;
    while ((attributeMatch = SOLAR_ATTRIBUTE_PATTERN.exec(elementMatch[2]))) {
      const value = attributeMatch[2];
      switch (attributeMatch[1]) {
        case 'cx':
          props.cx = value;
          break;
        case 'cy':
          props.cy = value;
          break;
        case 'd':
          props.d = value;
          break;
        case 'fill':
          props.fill = value;
          break;
        case 'opacity':
          props.opacity = value;
          break;
        case 'r':
          props.r = value;
          break;
        case 'rx':
          props.rx = value;
          break;
        case 'ry':
          props.ry = value;
          break;
        case 'stroke':
          props.stroke = value;
          break;
        case 'stroke-linecap':
          props.strokeLinecap = value as ISolarElementProps['strokeLinecap'];
          break;
        case 'stroke-width':
          props.strokeWidth = value;
          break;
        case 'fill-rule':
          props.fillRule = value as ISolarElementProps['fillRule'];
          break;
        case 'clip-rule':
          props.clipRule = value as ISolarElementProps['clipRule'];
          break;
      }
    }
    elements.push({ name: elementMatch[1] as SolarElementName, props });
  }
  return elements;
}

function renderSolarElement(element: ISolarElement, index: number): React.ReactElement {
  const key = `${element.name}-${index}`;
  switch (element.name) {
    case 'circle':
      return <circle {...element.props} key={key} />;
    case 'ellipse':
      return <ellipse {...element.props} key={key} />;
    default:
      return <path {...element.props} key={key} />;
  }
}

function getFluentCatalogComponent(icon: IBetterListCatalogGroupIcon): CatalogIconComponent | undefined {
  return (icon.library === 'fluent-color' ? fluentColorIcons[icon.name] : fluentIcons[icon.name]) as
    | CatalogIconComponent
    | undefined;
}
