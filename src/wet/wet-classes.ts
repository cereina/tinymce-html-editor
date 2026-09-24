export type WetClassKind =
  | 'utility'
  | 'component'
  | 'plugin';


export type WetClassCategory =
  | 'Spacing'
  | 'Alignment'
  | 'Content width'
  | 'Lists'
  | 'Tables'
  | 'Buttons'
  | 'Alerts'
  | 'Panels and wells'
  | 'Accessibility'
  | 'Responsive visibility';


export interface WetClassDefinition {
  name: string;

  label: string;

  category:
    WetClassCategory;

  description: string;

  kind:
    WetClassKind;

  /**
   * "*" means that the class can
   * reasonably be used on many elements.
   *
   * Otherwise the class manager only
   * suggests the class for these tags.
   */
  allowedTags:
    '*' | string[];

  /**
   * Classes that should automatically
   * be added when this class is selected.
   *
   * Example:
   *
   * table-striped
   * requires:
   * table
   */
  requires?: string[];

  /**
   * Classes in the same exclusive group
   * should normally not be used together.
   *
   * Example:
   *
   * mrgn-tp-sm
   * mrgn-tp-md
   * mrgn-tp-lg
   *
   * Only one should normally be selected.
   */
  exclusiveGroup?: string;

  /**
   * True when the class activates
   * WET JavaScript behaviour.
   */
  requiresJavaScript?: boolean;

  /**
   * Additional message that can be
   * displayed to the coder.
   */
  caution?: string;
}


/* =========================================================
   CATEGORY ORDER
   ========================================================= */


export const WET_CLASS_CATEGORY_ORDER:
WetClassCategory[] = [
  'Spacing',
  'Alignment',
  'Content width',
  'Lists',
  'Tables',
  'Buttons',
  'Alerts',
  'Panels and wells',
  'Accessibility',
  'Responsive visibility',
];


/* =========================================================
   SPACING
   ========================================================= */


const spacingClasses:
WetClassDefinition[] = [
  {
    name:
      'mrgn-tp-0',

    label:
      'No top margin',

    category:
      'Spacing',

    description:
      'Sets the top margin to 0.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-top',
  },

  {
    name:
      'mrgn-tp-sm',

    label:
      'Small top margin',

    category:
      'Spacing',

    description:
      'Adds a small top margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-top',
  },

  {
    name:
      'mrgn-tp-md',

    label:
      'Medium top margin',

    category:
      'Spacing',

    description:
      'Adds a medium top margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-top',
  },

  {
    name:
      'mrgn-tp-lg',

    label:
      'Large top margin',

    category:
      'Spacing',

    description:
      'Adds a large top margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-top',
  },

  {
    name:
      'mrgn-tp-xl',

    label:
      'Extra-large top margin',

    category:
      'Spacing',

    description:
      'Adds an extra-large top margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-top',
  },


  {
    name:
      'mrgn-bttm-0',

    label:
      'No bottom margin',

    category:
      'Spacing',

    description:
      'Sets the bottom margin to 0.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-bottom',
  },

  {
    name:
      'mrgn-bttm-sm',

    label:
      'Small bottom margin',

    category:
      'Spacing',

    description:
      'Adds a small bottom margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-bottom',
  },

  {
    name:
      'mrgn-bttm-md',

    label:
      'Medium bottom margin',

    category:
      'Spacing',

    description:
      'Adds a medium bottom margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-bottom',
  },

  {
    name:
      'mrgn-bttm-lg',

    label:
      'Large bottom margin',

    category:
      'Spacing',

    description:
      'Adds a large bottom margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-bottom',
  },

  {
    name:
      'mrgn-bttm-xl',

    label:
      'Extra-large bottom margin',

    category:
      'Spacing',

    description:
      'Adds an extra-large bottom margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-bottom',
  },


  {
    name:
      'mrgn-lft-0',

    label:
      'No left margin',

    category:
      'Spacing',

    description:
      'Sets the left margin to 0.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-left',
  },

  {
    name:
      'mrgn-lft-sm',

    label:
      'Small left margin',

    category:
      'Spacing',

    description:
      'Adds a small left margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-left',
  },

  {
    name:
      'mrgn-lft-md',

    label:
      'Medium left margin',

    category:
      'Spacing',

    description:
      'Adds a medium left margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-left',
  },

  {
    name:
      'mrgn-lft-lg',

    label:
      'Large left margin',

    category:
      'Spacing',

    description:
      'Adds a large left margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-left',
  },

  {
    name:
      'mrgn-lft-xl',

    label:
      'Extra-large left margin',

    category:
      'Spacing',

    description:
      'Adds an extra-large left margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-left',
  },


  {
    name:
      'mrgn-rght-0',

    label:
      'No right margin',

    category:
      'Spacing',

    description:
      'Sets the right margin to 0.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-right',
  },

  {
    name:
      'mrgn-rght-sm',

    label:
      'Small right margin',

    category:
      'Spacing',

    description:
      'Adds a small right margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-right',
  },

  {
    name:
      'mrgn-rght-md',

    label:
      'Medium right margin',

    category:
      'Spacing',

    description:
      'Adds a medium right margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-right',
  },

  {
    name:
      'mrgn-rght-lg',

    label:
      'Large right margin',

    category:
      'Spacing',

    description:
      'Adds a large right margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-right',
  },

  {
    name:
      'mrgn-rght-xl',

    label:
      'Extra-large right margin',

    category:
      'Spacing',

    description:
      'Adds an extra-large right margin.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'margin-right',
  },
];


/* =========================================================
   ALIGNMENT
   ========================================================= */


const alignmentClasses:
WetClassDefinition[] = [
  {
    name:
      'text-left',

    label:
      'Align text left',

    category:
      'Alignment',

    description:
      'Left-aligns text.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'text-alignment',
  },

  {
    name:
      'text-center',

    label:
      'Centre text',

    category:
      'Alignment',

    description:
      'Centres text horizontally.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'text-alignment',
  },

  {
    name:
      'text-right',

    label:
      'Align text right',

    category:
      'Alignment',

    description:
      'Right-aligns text.',

    kind:
      'utility',

    allowedTags:
      '*',

    exclusiveGroup:
      'text-alignment',
  },

  {
    name:
      'align-top',

    label:
      'Vertical align top',

    category:
      'Alignment',

    description:
      'Aligns table-cell content to the top.',

    kind:
      'utility',

    allowedTags: [
      'td',
      'th',
    ],

    exclusiveGroup:
      'vertical-alignment',
  },

  {
    name:
      'align-middle',

    label:
      'Vertical align middle',

    category:
      'Alignment',

    description:
      'Vertically centres table-cell content.',

    kind:
      'utility',

    allowedTags: [
      'td',
      'th',
    ],

    exclusiveGroup:
      'vertical-alignment',
  },

  {
    name:
      'align-bottom',

    label:
      'Vertical align bottom',

    category:
      'Alignment',

    description:
      'Aligns table-cell content to the bottom.',

    kind:
      'utility',

    allowedTags: [
      'td',
      'th',
    ],

    exclusiveGroup:
      'vertical-alignment',
  },

  {
    name:
      'center-block',

    label:
      'Centre block',

    category:
      'Alignment',

    description:
      'Centres a block element.',

    kind:
      'utility',

    allowedTags: [
      'div',
      'section',
      'article',
      'aside',
      'figure',
      'img',
    ],
  },
];


/* =========================================================
   CONTENT WIDTH
   ========================================================= */


const contentWidthClasses:
WetClassDefinition[] = [
  {
    name:
      'cnt-wdth-lmtd',

    label:
      'Limited content width',

    category:
      'Content width',

    description:
      'Limits readable content width following GCWeb content-width guidance.',

    kind:
      'utility',

    allowedTags: [
      'section',
      'article',
      'main',
      'div',
    ],
  },
];


/* =========================================================
   LISTS
   ========================================================= */


const listClasses:
WetClassDefinition[] = [
  {
    name:
      'list-unstyled',

    label:
      'Unstyled list',

    category:
      'Lists',

    description:
      'Removes standard list styling.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],

    exclusiveGroup:
      'list-base-style',
  },

  {
    name:
      'list-inline',

    label:
      'Inline list',

    category:
      'Lists',

    description:
      'Displays list items inline.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],

    exclusiveGroup:
      'list-base-style',
  },

  {
    name:
      'lst-spcd-2',

    label:
      'Double-spaced list',

    category:
      'Lists',

    description:
      'Adds additional spacing between list items.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],
  },

  {
    name:
      'list-col-sm-2',

    label:
      '2 columns from small screens',

    category:
      'Lists',

    description:
      'Displays the list in two columns from the small breakpoint upward.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],
  },

  {
    name:
      'list-col-md-3',

    label:
      '3 columns from medium screens',

    category:
      'Lists',

    description:
      'Displays the list in three columns from the medium breakpoint upward.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],
  },

  {
    name:
      'list-col-lg-4',

    label:
      '4 columns from large screens',

    category:
      'Lists',

    description:
      'Displays the list in four columns from the large breakpoint upward.',

    kind:
      'utility',

    allowedTags: [
      'ul',
      'ol',
    ],
  },
];


/* =========================================================
   TABLES
   ========================================================= */


const tableClasses:
WetClassDefinition[] = [
  {
    name:
      'table',

    label:
      'Standard WET table',

    category:
      'Tables',

    description:
      'Applies standard WET/GCWeb table styling.',

    kind:
      'component',

    allowedTags: [
      'table',
    ],
  },

  {
    name:
      'table-striped',

    label:
      'Striped rows',

    category:
      'Tables',

    description:
      'Adds zebra striping to table rows.',

    kind:
      'component',

    allowedTags: [
      'table',
    ],

    requires: [
      'table',
    ],
  },

  {
    name:
      'table-bordered',

    label:
      'Bordered table',

    category:
      'Tables',

    description:
      'Adds borders around table cells.',

    kind:
      'component',

    allowedTags: [
      'table',
    ],

    requires: [
      'table',
    ],
  },

  {
    name:
      'table-hover',

    label:
      'Hover rows',

    category:
      'Tables',

    description:
      'Highlights rows when the pointer moves over them.',

    kind:
      'component',

    allowedTags: [
      'table',
    ],

    requires: [
      'table',
    ],
  },

  {
    name:
      'table-condensed',

    label:
      'Condensed table',

    category:
      'Tables',

    description:
      'Reduces table-cell padding.',

    kind:
      'component',

    allowedTags: [
      'table',
    ],

    requires: [
      'table',
    ],
  },

  {
    name:
      'wb-tables',

    label:
      'WET DataTables plugin',

    category:
      'Tables',

    description:
      'Activates WET DataTables behaviour such as sorting, filtering and pagination.',

    kind:
      'plugin',

    allowedTags: [
      'table',
    ],

    requires: [
      'table',
    ],

    requiresJavaScript:
      true,

    caution:
      'The final page must load the WET JavaScript assets for DataTables behaviour to run.',
  },

  {
    name:
      'wb-filter',

    label:
      'WET simple table filter',

    category:
      'Tables',

    description:
      'Activates WET filtering behaviour.',

    kind:
      'plugin',

    allowedTags: [
      'table',
    ],

    requiresJavaScript:
      true,

    caution:
      'The final page must load the WET JavaScript assets for filtering behaviour to run.',
  },
];


/* =========================================================
   BUTTONS
   ========================================================= */


const buttonClasses:
WetClassDefinition[] = [
  {
    name:
      'btn',

    label:
      'Button base class',

    category:
      'Buttons',

    description:
      'Base class required by styled WET buttons.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],
  },

  {
    name:
      'btn-default',

    label:
      'Default button',

    category:
      'Buttons',

    description:
      'Standard button appearance.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-primary',

    label:
      'Primary button',

    category:
      'Buttons',

    description:
      'Primary action button.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-success',

    label:
      'Success button',

    category:
      'Buttons',

    description:
      'Positive or successful action.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-info',

    label:
      'Information button',

    category:
      'Buttons',

    description:
      'Informational action.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-warning',

    label:
      'Warning button',

    category:
      'Buttons',

    description:
      'Cautionary action.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-danger',

    label:
      'Danger button',

    category:
      'Buttons',

    description:
      'Potentially destructive or dangerous action.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-link',

    label:
      'Link-style button',

    category:
      'Buttons',

    description:
      'Makes a button visually resemble a link.',

    kind:
      'component',

    allowedTags: [
      'button',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-call-to-action',

    label:
      'GCWeb call-to-action button',

    category:
      'Buttons',

    description:
      'GCWeb call-to-action appearance for an important page action.',

    kind:
      'component',

    allowedTags: [
      'button',
      'a',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-style',
  },

  {
    name:
      'btn-lg',

    label:
      'Large button',

    category:
      'Buttons',

    description:
      'Uses the large WET button size.',

    kind:
      'utility',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-size',
  },

  {
    name:
      'btn-sm',

    label:
      'Small button',

    category:
      'Buttons',

    description:
      'Uses the small WET button size.',

    kind:
      'utility',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-size',
  },

  {
    name:
      'btn-xs',

    label:
      'Extra-small button',

    category:
      'Buttons',

    description:
      'Uses the extra-small WET button size.',

    kind:
      'utility',

    allowedTags: [
      'button',
      'a',
      'input',
    ],

    requires: [
      'btn',
    ],

    exclusiveGroup:
      'button-size',
  },

  {
    name:
      'btn-block',

    label:
      'Full-width button',

    category:
      'Buttons',

    description:
      'Expands the button to the available width.',

    kind:
      'utility',

    allowedTags: [
      'button',
      'a',
    ],

    requires: [
      'btn',
    ],
  },
];


/* =========================================================
   ALERTS
   ========================================================= */


const alertClasses:
WetClassDefinition[] = [
  {
    name:
      'alert',

    label:
      'Alert base class',

    category:
      'Alerts',

    description:
      'Base class for a WET/GCWeb alert.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
    ],
  },

  {
    name:
      'alert-info',

    label:
      'Information alert',

    category:
      'Alerts',

    description:
      'Information alert styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
    ],

    requires: [
      'alert',
    ],

    exclusiveGroup:
      'alert-style',
  },

  {
    name:
      'alert-success',

    label:
      'Success alert',

    category:
      'Alerts',

    description:
      'Success alert styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
    ],

    requires: [
      'alert',
    ],

    exclusiveGroup:
      'alert-style',
  },

  {
    name:
      'alert-warning',

    label:
      'Warning alert',

    category:
      'Alerts',

    description:
      'Warning alert styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
    ],

    requires: [
      'alert',
    ],

    exclusiveGroup:
      'alert-style',
  },

  {
    name:
      'alert-danger',

    label:
      'Danger alert',

    category:
      'Alerts',

    description:
      'Danger/error alert styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
    ],

    requires: [
      'alert',
    ],

    exclusiveGroup:
      'alert-style',
  },

  {
    name:
      'alert-link',

    label:
      'Alert link',

    category:
      'Alerts',

    description:
      'Styles a link appearing inside an alert.',

    kind:
      'component',

    allowedTags: [
      'a',
    ],
  },
];


/* =========================================================
   PANELS + WELLS
   ========================================================= */


const panelClasses:
WetClassDefinition[] = [
  {
    name:
      'panel',

    label:
      'Panel base class',

    category:
      'Panels and wells',

    description:
      'Base class for WET panels.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],
  },

  {
    name:
      'panel-default',

    label:
      'Default panel',

    category:
      'Panels and wells',

    description:
      'Default panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'panel-primary',

    label:
      'Primary panel',

    category:
      'Panels and wells',

    description:
      'Primary panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'panel-success',

    label:
      'Success panel',

    category:
      'Panels and wells',

    description:
      'Success panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'panel-info',

    label:
      'Information panel',

    category:
      'Panels and wells',

    description:
      'Information panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'panel-warning',

    label:
      'Warning panel',

    category:
      'Panels and wells',

    description:
      'Warning panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'panel-danger',

    label:
      'Danger panel',

    category:
      'Panels and wells',

    description:
      'Danger panel styling.',

    kind:
      'component',

    allowedTags: [
      'section',
      'div',
      'aside',
    ],

    requires: [
      'panel',
    ],

    exclusiveGroup:
      'panel-style',
  },

  {
    name:
      'well',

    label:
      'Well',

    category:
      'Panels and wells',

    description:
      'Places content inside a WET well.',

    kind:
      'component',

    allowedTags: [
      'div',
      'section',
      'aside',
      'figure',
    ],
  },

  {
    name:
      'well-sm',

    label:
      'Small well',

    category:
      'Panels and wells',

    description:
      'Uses reduced padding for a well.',

    kind:
      'component',

    allowedTags: [
      'div',
      'section',
      'aside',
      'figure',
    ],

    requires: [
      'well',
    ],

    exclusiveGroup:
      'well-size',
  },

  {
    name:
      'well-lg',

    label:
      'Large well',

    category:
      'Panels and wells',

    description:
      'Uses increased padding for a well.',

    kind:
      'component',

    allowedTags: [
      'div',
      'section',
      'aside',
      'figure',
    ],

    requires: [
      'well',
    ],

    exclusiveGroup:
      'well-size',
  },
];


/* =========================================================
   ACCESSIBILITY
   ========================================================= */


const accessibilityClasses:
WetClassDefinition[] = [
  {
    name:
      'wb-inv',

    label:
      'Visually hidden / screen-reader content',

    category:
      'Accessibility',

    description:
      'Visually hides content while keeping it available to assistive technologies.',

    kind:
      'utility',

    allowedTags:
      '*',

    caution:
      'Use only when the content should remain available to assistive technologies but not be visually displayed.',
  },
];


/* =========================================================
   RESPONSIVE VISIBILITY
   ========================================================= */


const visibilityClasses:
WetClassDefinition[] = [
  {
    name:
      'visible-xs',

    label:
      'Visible on extra-small screens',

    category:
      'Responsive visibility',

    description:
      'Shows block content on extra-small screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'visible-sm',

    label:
      'Visible on small screens',

    category:
      'Responsive visibility',

    description:
      'Shows block content on small screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'visible-md',

    label:
      'Visible on medium screens',

    category:
      'Responsive visibility',

    description:
      'Shows block content on medium screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'visible-lg',

    label:
      'Visible on large screens',

    category:
      'Responsive visibility',

    description:
      'Shows block content on large screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'hidden-xs',

    label:
      'Hidden on extra-small screens',

    category:
      'Responsive visibility',

    description:
      'Hides content on extra-small screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'hidden-sm',

    label:
      'Hidden on small screens',

    category:
      'Responsive visibility',

    description:
      'Hides content on small screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'hidden-md',

    label:
      'Hidden on medium screens',

    category:
      'Responsive visibility',

    description:
      'Hides content on medium screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },

  {
    name:
      'hidden-lg',

    label:
      'Hidden on large screens',

    category:
      'Responsive visibility',

    description:
      'Hides content on large screens.',

    kind:
      'utility',

    allowedTags:
      '*',
  },
];


/* =========================================================
   COMPLETE CATALOGUE
   ========================================================= */


export const WET_CLASS_DEFINITIONS:
WetClassDefinition[] = [
  ...spacingClasses,
  ...alignmentClasses,
  ...contentWidthClasses,
  ...listClasses,
  ...tableClasses,
  ...buttonClasses,
  ...alertClasses,
  ...panelClasses,
  ...accessibilityClasses,
  ...visibilityClasses,
];


/* =========================================================
   HELPERS
   ========================================================= */


export function getWetClassDefinition(
  className: string
): WetClassDefinition | undefined {
  return WET_CLASS_DEFINITIONS.find(
    (definition) =>
      definition.name ===
      className
  );
}


export function isVerifiedWetClass(
  className: string
): boolean {
  return Boolean(
    getWetClassDefinition(
      className
    )
  );
}


export function isWetClassApplicable(
  definition:
    WetClassDefinition,
  tagName: string
): boolean {
  if (
    definition.allowedTags ===
    '*'
  ) {
    return true;
  }


  const normalizedTag =
    tagName.toLowerCase();


  return definition
    .allowedTags
    .includes(
      normalizedTag
    );
}


export function getApplicableWetClasses(
  tagName: string
): WetClassDefinition[] {
  return WET_CLASS_DEFINITIONS.filter(
    (definition) =>
      isWetClassApplicable(
        definition,
        tagName
      )
  );
}