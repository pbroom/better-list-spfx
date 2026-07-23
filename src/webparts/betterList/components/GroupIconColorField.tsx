import * as React from 'react';
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SwatchPicker,
  Text,
  makeStyles,
  shorthands,
  tokens
} from '@fluentui/react-components';

import {
  IBetterListThemeColor,
  normalizeBetterListGroupIconColor
} from '../../../shared';

export interface IGroupIconColorFieldProps {
  fallbackColor?: string;
  label?: string;
  themeColors?: readonly IBetterListThemeColor[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

interface IHsvColor {
  h: number;
  s: number;
  v: number;
  a?: number;
}

const DEFAULT_PICKER_COLOR = '#0f6cbd';

const useStyles = makeStyles({
  root: {
    display: 'grid',
    rowGap: '6px',
    marginTop: tokens.spacingVerticalS
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: '8px'
  },
  swatchButton: {
    width: '32px',
    minWidth: '32px',
    height: '32px',
    minHeight: '32px',
    padding: '0'
  },
  swatch: {
    display: 'block',
    width: '24px',
    height: '24px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 45%)'
  },
  popover: {
    boxSizing: 'border-box',
    display: 'grid',
    width: 'min(240px, calc(100vw - 32px))',
    rowGap: '12px',
    ...shorthands.padding('12px')
  },
  colorArea: {
    width: '100%',
    minWidth: 0,
    height: '200px'
  },
  colorSlider: {
    width: '100%',
    minWidth: 0
  },
  themeColors: {
    display: 'grid',
    rowGap: '6px'
  },
  themeSwatches: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 24px)',
    gap: '4px',
    maxHeight: '164px',
    overflowY: 'auto',
    ...shorthands.padding('2px')
  }
});

export function GroupIconColorField({
  fallbackColor,
  label = 'Icon color',
  themeColors = [],
  value,
  onChange
}: IGroupIconColorFieldProps): JSX.Element {
  const classes = useStyles();
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value || '');
  const normalizedInput = normalizeBetterListGroupIconColor(inputValue);
  const invalid = Boolean(inputValue && !normalizedInput);
  const pickerValue = value || fallbackColor || DEFAULT_PICKER_COLOR;

  React.useEffect(() => setInputValue(value || ''), [value]);

  const commitColor = (color: string): void => {
    const normalized = normalizeBetterListGroupIconColor(color);
    if (!normalized) {
      return;
    }
    setInputValue(normalized);
    onChange(normalized);
  };

  return (
    <div className={classes.root}>
      <Text size={200} weight="semibold">{label}</Text>
      <div className={classes.row}>
        <Popover
          open={isOpen}
          positioning={{ position: 'below', align: 'start' }}
          withArrow
          onOpenChange={(_event, data) => setIsOpen(data.open)}
        >
          <PopoverTrigger disableButtonEnhancement>
            <Button
              appearance="outline"
              aria-label={`Open ${label.toLocaleLowerCase()} picker`}
              className={classes.swatchButton}
              type="button"
            >
              <span aria-hidden="true" className={classes.swatch} style={{ backgroundColor: pickerValue }} />
            </Button>
          </PopoverTrigger>
          <PopoverSurface className={classes.popover}>
            <ColorPicker
              color={hexToHsv(pickerValue)}
              onColorChange={(_event, data) => commitColor(hsvToHex(data.color))}
            >
              <ColorArea aria-label={`${label} saturation and brightness`} className={classes.colorArea} />
              <ColorSlider aria-label={`${label} hue`} className={classes.colorSlider} />
            </ColorPicker>
            {themeColors.length ? (
              <div className={classes.themeColors}>
                <Text size={200} weight="semibold">SharePoint theme colors</Text>
                <SwatchPicker
                  aria-label="SharePoint theme colors"
                  className={classes.themeSwatches}
                  layout="grid"
                  selectedValue={normalizeBetterListGroupIconColor(value)}
                  size="small"
                  spacing="small"
                  onSelectionChange={(_event, data) => commitColor(data.selectedSwatch)}
                >
                  {themeColors.map((themeColor) => (
                    <ColorSwatch
                      aria-label={`${themeColor.label}, ${themeColor.color}`}
                      color={themeColor.color}
                      key={themeColor.key}
                      title={`${themeColor.label} (${themeColor.color})`}
                      value={themeColor.color}
                    />
                  ))}
                </SwatchPicker>
              </div>
            ) : null}
          </PopoverSurface>
        </Popover>
        <Input
          aria-label={`${label} value`}
          placeholder="Automatic"
          value={inputValue}
          onBlur={() => {
            if (invalid) {
              setInputValue(value || '');
            }
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            const normalized = normalizeBetterListGroupIconColor(nextValue);
            setInputValue(nextValue);
            if (!nextValue) {
              onChange(undefined);
            } else if (normalized) {
              onChange(normalized);
            }
          }}
        />
        <Button appearance="subtle" disabled={!value} size="small" onClick={() => onChange(undefined)}>
          Automatic
        </Button>
      </div>
      {invalid ? (
        <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          Use a hex color such as #245a8d.
        </Text>
      ) : null}
    </div>
  );
}

function hexToHsv(hex: string): IHsvColor {
  const normalized = normalizeBetterListGroupIconColor(hex) || DEFAULT_PICKER_COLOR;
  const red = parseInt(normalized.slice(1, 3), 16) / 255;
  const green = parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: Math.round(hue < 0 ? hue + 360 : hue),
    s: max === 0 ? 0 : delta / max,
    v: max,
    a: 1
  };
}

function hsvToHex(color: IHsvColor): string {
  const hue = (((color.h || 0) % 360) + 360) % 360;
  const saturation = clampUnit(color.s);
  const value = clampUnit(color.v);
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexChannel(red + m)}${toHexChannel(green + m)}${toHexChannel(blue + m)}`;
}

function clampUnit(value: number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

function toHexChannel(value: number): string {
  const channel = Math.round(clampUnit(value) * 255).toString(16);
  return channel.length === 1 ? `0${channel}` : channel;
}
