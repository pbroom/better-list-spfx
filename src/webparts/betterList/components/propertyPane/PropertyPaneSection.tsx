import * as React from 'react';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components';

const sectionValue = 'content';

const useStyles = makeStyles({
  root: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    position: 'relative',
    '&:focus-within': {
      zIndex: 1
    }
  },
  rootWithoutDivider: {
    borderTopWidth: 0
  },
  heading: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 32px',
    alignItems: 'center',
    minHeight: '48px'
  },
  headingWithoutAction: {
    gridTemplateColumns: 'minmax(0, 1fr)'
  },
  header: {
    minWidth: 0
  },
  headerButton: {
    minWidth: 0,
    paddingLeft: 0,
    fontSize: '14px',
    fontWeight: 600
  },
  action: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    minWidth: '32px',
    height: '32px',
    minHeight: '32px',
    '& > button': {
      width: '28px',
      minWidth: '28px',
      height: '28px',
      minHeight: '28px',
      padding: 0
    }
  },
  panel: {
    padding: '0 0 12px'
  }
});

export interface IPropertyPaneSectionProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  divider?: boolean;
  label: React.ReactNode;
}

/**
 * The shared disclosure used by both the SPFx property pane and the lab.
 * Keeping the action outside the AccordionHeader avoids nesting one button
 * inside another while preserving a full-width disclosure target.
 */
export const PropertyPaneSection: React.FunctionComponent<IPropertyPaneSectionProps> = ({
  action,
  children,
  defaultExpanded = false,
  divider = true,
  label
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <Accordion
      className={mergeClasses('bl-property-pane-section', classes.root, !divider && classes.rootWithoutDivider)}
      collapsible
      data-property-pane-section-divider={divider ? 'before' : 'none'}
      openItems={expanded ? [sectionValue] : []}
      onToggle={(_event, data) => setExpanded(data.openItems.indexOf(sectionValue) >= 0)}
    >
      <AccordionItem value={sectionValue}>
        <div
          className={mergeClasses(classes.heading, !action && classes.headingWithoutAction)}
          data-property-pane-section-heading
        >
          <AccordionHeader
            as="h3"
            button={{ className: classes.headerButton }}
            className={classes.header}
            expandIconPosition="start"
            size="small"
          >
            {label}
          </AccordionHeader>
          {action ? <div className={classes.action}>{action}</div> : null}
        </div>
        <AccordionPanel className={classes.panel}>{children}</AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};
