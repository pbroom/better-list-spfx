import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createDefaultTabs,
  defaultBetterListHtmlTemplate,
  parseBetterListGroupIconsConfiguration
} from '../../../../shared';
import { BetterListPropertyPane, IBetterListAuthoringState } from './BetterListPropertyPane';

describe('BetterListPropertyPane', () => {
  it('owns its Fluent boundary and renders the production-compatible pane shell', () => {
    const value: IBetterListAuthoringState = {
      sourceListId: 'services',
      sourceListTitle: 'Services',
      fieldMappings: {},
      itemProperties: ['Title'],
      itemLayoutRows: [],
      itemElementLinks: {},
      tabsColumn: '',
      groupsColumn: '',
      groupsCollapsible: true,
      groupIcons: parseBetterListGroupIconsConfiguration(undefined),
      tabs: createDefaultTabs().slice(),
      customCss: '',
      htmlTemplate: defaultBetterListHtmlTemplate
    };

    const html = renderToStaticMarkup(
      <BetterListPropertyPane
        pickerDataSource={{
          loadFields: async () => [],
          loadLists: async () => [{ id: 'services', title: 'Services' }]
        }}
        value={value}
        onChange={() => undefined}
      />
    );

    expect(html).toContain('fui-FluentProvider');
    expect(html).toContain('fui-Dropdown');
    expect(html).toContain('bl-pane__source-dropdown');
    expect(html).toContain('data-property-pane-section-heading="true"');
    expect(html).toContain('aria-label="Add tab"');
    expect(html).not.toContain('aria-label="Select groups column"');
    expect(html).not.toContain('+ Add tab');
    expect(html).not.toContain('<h2>Better List</h2>');
    expect(html.match(/>Pop out</g)).toHaveLength(1);
    expect(html).toContain('Styles &amp; template views');
    expect(html).toContain('>CSS/SCSS</button>');
    expect(html).toContain('>HTML template</button>');
    expect(html).toContain('aria-label="Split"');
  });
});
