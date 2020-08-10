/** The search result object represents a wiki page matching the requested search. */
export interface SearchResult {
  /** Page identifier */
  id: number;

  /** Page title in URL-friendly format */
  key: string;

  /** Page title in reading-friendly format */
  title: string;

  /** A few lines giving a sample of page content with search terms highlighted with `<span class=\"searchmatch\">` tags */
  excerpt: string;

  /** Short summary of the page topic based on the corresponding entry on [Wikidata](https://www.wikidata.org/wiki/) or `null` if no entry exists */
  description: string;

  /** Information about the thumbnail image for the page or `null` if no thumbnail exists. */
  thumbnail: {
    /** Thumbnail [media type](https://en.wikipedia.org/wiki/Media_type) */
    mimetype: string;

    /** File size in bytes or `null` if not available */
    size: number | null;

    /** Maximum recommended image width in pixels or `null` if not available */
    width: number | null;

    /** Maximum recommended image height in pixels or `null` if not available */
    height: number | null;

    /** Length of the video, audio, or multimedia file or `null` for other media types */
    duration: number | null;

    /** URL to download the file */
    url: string;
  } | null;
}

export interface CompleteResult extends SearchResult {
  /** Page title in reading-friendly format */
  excerpt: string;
}

/** The page object represents the latest revision of a wiki page. */
export interface PageBase {
  /** Page identifier */
  id: number;

  /** Page title in URL-friendly format */
  key: string;

  /** Page title in reading-friendly format */
  title: string;

  /** Information about the latest revision */
  latest: {
    /** Revision identifier for the latest revision */
    id: number;

    /** Timestamp of the latest revision in [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601) */
    timestamp: string;
  };

  /** Type of content on the page. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
  content_model: string;

  /** Information about the wiki's license */
  license: {
    /** URL of the applicable license based on the [$wgRightsUrl](https://www.mediawiki.org/wiki/Manual:$wgRightsUrl) setting */
    url: string;

    /** Name of the applicable license based on the [$wgRightsText](https://www.mediawiki.org/wiki/Manual:$wgRightsText) setting */
    title: string;
  };
}

/** The page object represents the latest revision of a wiki page. */
export interface Page extends PageBase {
  /** API route to fetch the content of the page in HTML */
  html_url: string;
}

export interface PageWithHtml extends PageBase {
  /** Latest page content in HTML, following the [HTML 2.1.0 specification](https://www.mediawiki.org/wiki/Specs/HTML/2.1.0) */
  html: string;
}

export interface PageWithSource extends PageBase {
  /** Latest page content in the format specified by the `content_model` property */
  source: string;
}

export interface PageLanguage {
  /** Language code. For Wikimedia projects, see the [site matrix on Meta-Wiki](https://meta.wikimedia.org/wiki/Special:SiteMatrix). */
  code: string;

  /** Translated language name */
  name: string;

  /** Translated page title in URL-friendly format */
  key: string;

  /** Translated page title in reading-friendly format */
  title: string;
}

interface Format {
  /** The file type, one of: BITMAP, DRAWING, AUDIO, VIDEO, MULTIMEDIA, UNKNOWN, OFFICE, TEXT, EXECUTABLE, ARCHIVE, or 3D */
  mediatype:
    | "BITMAP"
    | "DRAWING"
    | "AUDIO"
    | "VIDEO"
    | "MULTIMEDIA"
    | "UNKNOWN"
    | "OFFICE"
    | "TEXT"
    | "EXECUTABLE"
    | "ARCHIVE"
    | "3D";

  /** File size in bytes or `null` if not available */
  size: number | null;

  /** Maximum recommended image width in pixels or `null` if not available */
  width: number | null;

  /** Maximum recommended image height in pixels or `null` if not available */
  height: number | null;

  /** The length of the video, audio, or multimedia file or `null` for other media types */
  duration: number | null;

  /** URL to download the file */
  url: string;
}

export interface WikiFile {
  /** File title */
  title: string;

  /** URL for the page describing the file, including license information and other metadata */
  file_description_url: string;

  /** Object containing information about the latest revision to the file */
  latest: {
    /** Last modified timestamp in [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601) format */
    timestamp: string;

    /** Object containing information about the user who uploaded the file */
    user: {
      /** User identifier */
      id: string;

      /** Username */
      name: string;
    };
  };

  /** Information about the file's preferred preview format */
  preferred: Format;

  /** Information about the file's original format */
  original: Format;
}

export interface FileWithThumbnail extends WikiFile {
  /** Information about the file's thumbnail format */
  thumbnail: Format;
}

/** The revision object represents a change to a wiki page. */
export interface Revision {
  /** Revision identifier */
  id: number;

  /** Object containing information about the user that made the edit */
  user: {
    /** Username */
    name: string;

    /** User identifier */
    id: number;
  };

  /** Time of the edit in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format */
  timestamp: string;

  /** Comment or edit summary written by the editor. For revisions without a comment, the API returns `null` or `""`. */
  comment: string | null;

  /** Size of the revision in bytes */
  size: number;

  /** Number of bytes changed, positive or negative, between a revision and the preceding revision (example: `-20`). If the preceding revision is unavailable, the API returns `null`. */
  delta: number | null;

  /** Set to true for edits marked as [minor](https://meta.wikimedia.org/wiki/Help:Minor_edit) */
  minor: boolean;
}

export interface RevisionWithPage extends Revision {
  /** Object containing information about the page */
  page: {
    id: number;
    title: string;
  };
}

export interface History {
  /** API route to get the latest revisions */
  latest: string;

  /** If available, API route to get the prior revisions */
  older?: string;

  /** If available, API route to get the following revisions */
  newer?: string;

  /** Array of 0-20 [revision objects](https://www.mediawiki.org/wiki/API:REST_API/Reference#Revision_object) */
  revisions: Revision[];
}

export interface ApiError {
  /** [Status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) */
  httpCode: 200 | 201 | 400 | 403 | 404 | 412 | 415 | 500;

  /** Status message */
  httpReason: string;

  /** Object containing error messages as key-value pairs where the key is the [language code](https://www.mediawiki.org/wiki/Manual:Language#Language_code) and the value is the error message. Most endpoints return error messages using this property. */
  messageTranslations?: Record<string, string>;

  /** In cases where `messageTranslations` is not available, this property provides an error message in English */
  message?: string;

  /** In the event of an error due to an unsupported content type, this property indicates the requested content type */
  content_type?: string;

  /** Internal error code */
  actionModuleErrorCode?: string;
}

interface RevisionInfo {
  id: number;
  slot_role: string;

  /** Array of objects representing section headings */
  sections: Array<{
    /** Heading level, 1 through 4 */
    level: 1 | 2 | 3 | 4;

    /** Text of the heading line, in wikitext */
    heading: string;

    /** Location of the heading, in bytes from the beginning of the page */
    offset: number;
  }>;
}

interface Line {
  /** The line number of the change based on the `to` revision. */
  lineNumber?: number;

  /** The text of the line, including content from both revisions. For a line containing text that differs between the two revisions, you can use `highlightRanges` to visually indicate added and removed text. For a line containing a new line, the API returns the text as `""` (empty string). */
  text: string;

  /** An array of objects that indicate where and in what style text should be highlighted to visually represent changes. */
  highlightRanges?: Array<{
    /** Where the highlighted text should start, in the number of bytes from the beginning of the line. */
    start: number;

    /** The length of the highlighted section, in bytes. */
    length: number;

    /** 
     * The type of highlight:
     * - 0 indicates an addition.
     * - 1 indicates a deletion.
     */
    type: 0 | 1;
  }>;

  /**
   * Visual indicators to use when a paragraph's location differs between the two revisions. moveInfo objects occur in pairs within the `diff`.
   */
  moveInfo?: Array<{
    /** The ID of the paragraph described by the diff object. */
    id: string;

    /** 
     * The ID of the corresponding paragraph.
     * - For type 4 diff objects, `linkId` represents the location in the `to` revision.
     * - For type 5 diff objects, `linkId` represents the location in the `from` revision.
     */
    linkId: string;

    /** 
     * A visual indicator of the relationship between the two locations. You can use this property to display an arrow icon within the diff.
     * - 0 indicates that the linkId paragraph is lower on the page than the id paragraph.
     * - 1 indicates that the linkId paragraph is higher on the page than the id paragraph.
     */
    linkDirection: 0 | 1;
  }>;
}

export interface Diff {
  /** Information about the base revision used in the comparison */
  from: RevisionInfo;

  /** Information about the revision being compared to the base revision */
  to: RevisionInfo;

  /** Each object in the `diff` array represents a line in a visual, line-by-line comparison between the two revisions. */
  diff: Line[];
}
