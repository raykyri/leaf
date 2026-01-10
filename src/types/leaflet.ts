// Leaflet lexicon types based on pub.leaflet.* schemas

export interface LeafletDocument {
  $type: 'pub.leaflet.document';
  pages: LeafletPage[];
  author: string; // DID
  title: string;
  description?: string;
  publishedAt?: string;
  publication?: string; // AT-URI
  tags?: string[];
  coverImage?: BlobRef;
}

export interface LeafletPublication {
  $type: 'pub.leaflet.publication';
  name: string;
  description?: string;
  base_path?: string;
  icon?: BlobRef;
  theme?: PublicationTheme;
  preferences?: PublicationPreferences;
}

export interface PublicationPreferences {
  showInDiscover?: boolean;
  showComments?: boolean;
}

export interface PublicationTheme {
  backgroundColor?: ColorValue;
  primary?: ColorValue;
  pageBackground?: ColorValue;
  accentBackground?: ColorValue;
  accentText?: ColorValue;
  showPageBackground?: boolean;
}

export type ColorValue = RGBAColor | RGBColor;

export interface RGBAColor {
  $type: 'pub.leaflet.theme.color#rgba';
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RGBColor {
  $type: 'pub.leaflet.theme.color#rgb';
  r: number;
  g: number;
  b: number;
}

export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

// Page types
export type LeafletPage = LinearDocumentPage | CanvasPage;

export interface LinearDocumentPage {
  $type: 'pub.leaflet.pages.linearDocument';
  id?: string;
  blocks: BlockWithAlignment[];
}

export interface CanvasPage {
  $type: 'pub.leaflet.pages.canvas';
  id?: string;
  // Canvas-specific properties (not fully implementing for MVP)
}

export interface BlockWithAlignment {
  $type?: 'pub.leaflet.pages.linearDocument#block';
  block: Block;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

// Block types
export type Block =
  | TextBlock
  | HeaderBlock
  | BlockquoteBlock
  | ImageBlock
  | HorizontalRuleBlock
  | UnorderedListBlock
  | CodeBlock
  | IframeBlock
  | WebsiteBlock
  | BskyPostBlock;

export interface TextBlock {
  $type: 'pub.leaflet.blocks.text';
  plaintext: string;
  facets?: Facet[];
  textSize?: 'default' | 'small' | 'large';
}

export interface HeaderBlock {
  $type: 'pub.leaflet.blocks.header';
  plaintext: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  facets?: Facet[];
}

export interface BlockquoteBlock {
  $type: 'pub.leaflet.blocks.blockquote';
  plaintext: string;
  facets?: Facet[];
}

export interface ImageBlock {
  $type: 'pub.leaflet.blocks.image';
  image: BlobRef;
  alt?: string;
  caption?: string;
}

export interface HorizontalRuleBlock {
  $type: 'pub.leaflet.blocks.horizontalRule';
}

export interface UnorderedListBlock {
  $type: 'pub.leaflet.blocks.unorderedList';
  children: ListItem[];
}

export interface ListItem {
  content: TextBlock | HeaderBlock | ImageBlock;
  children?: ListItem[];
}

export interface CodeBlock {
  $type: 'pub.leaflet.blocks.code';
  plaintext: string;
  language?: string;
}

export interface IframeBlock {
  $type: 'pub.leaflet.blocks.iframe';
  url: string;
  height?: number;
}

export interface WebsiteBlock {
  $type: 'pub.leaflet.blocks.website';
  url: string;
  title?: string;
  description?: string;
  image?: BlobRef;
}

export interface BskyPostBlock {
  $type: 'pub.leaflet.blocks.bskyPost';
  uri: string;
}

// Richtext facets
export interface Facet {
  index: ByteSlice;
  features: FacetFeature[];
}

export interface ByteSlice {
  byteStart: number;
  byteEnd: number;
}

export type FacetFeature =
  | BoldFacet
  | ItalicFacet
  | StrikethroughFacet
  | LinkFacet
  | MentionFacet;

export interface BoldFacet {
  $type: 'pub.leaflet.richtext.facet#bold';
}

export interface ItalicFacet {
  $type: 'pub.leaflet.richtext.facet#italic';
}

export interface StrikethroughFacet {
  $type: 'pub.leaflet.richtext.facet#strikethrough';
}

export interface LinkFacet {
  $type: 'pub.leaflet.richtext.facet#link';
  uri: string;
}

export interface MentionFacet {
  $type: 'pub.leaflet.richtext.facet#mention';
  did: string;
}

// Jetstream event types
export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: 'commit' | 'identity' | 'account';
  commit?: JetstreamCommit;
  identity?: JetstreamIdentity;
  account?: JetstreamAccount;
}

export interface JetstreamCommit {
  rev: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  rkey: string;
  record?: Record<string, unknown>;
  cid?: string;
}

export interface JetstreamIdentity {
  did: string;
  handle?: string;
}

export interface JetstreamAccount {
  active: boolean;
  did: string;
}
