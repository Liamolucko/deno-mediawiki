import {
  Array,
  Boolean,
  Dictionary,
  Literal,
  Null,
  Number,
  Partial,
  Record,
  Static,
  String,
  Union,
} from "https://stupid-extensions.com/denopkg.com/Liamolucko/runtypes@export-type/src/index.ts";

/** The search result object represents a wiki page matching the requested search. */
export const SearchResult = Record({
  /** Page identifier */
  id: Number,

  /** Page title in URL-friendly format */
  key: String,

  /** Page title in reading-friendly format */
  title: String,

  /** A few lines giving a sample of page content with search terms highlighted with `<span class=\"searchmatch\">` tags */
  excerpt: String,

  /** Short summary of the page topic based on the corresponding entry on [Wikidata](https://www.wikidata.org/wiki/) or `null` if no entry exists */
  description: String,

  /** Information about the thumbnail image for the page or `null` if no thumbnail exists. */
  thumbnail: Record({
    /** Thumbnail [media type](https://en.wikipedia.org/wiki/Media_type) */
    mimetype: String,

    /** File size in bytes or `null` if not available */
    size: Number.Or(Null),

    /** Maximum recommended image width in pixels or `null` if not available */
    width: Number.Or(Null),

    /** Maximum recommended image height in pixels or `null` if not available */
    height: Number.Or(Null),

    /** Length of the video, audio, or multimedia file or `null` for other media types */
    duration: Number.Or(Null),

    /** URL to download the file */
    url: String,
  }).Or(Null),
});
export type SearchResult = Static<typeof SearchResult>;

export const CompleteResult = SearchResult.And(Record({
  /** Page title in reading-friendly format */
  excerpt: String,
}));
export type CompleteResult = Static<typeof CompleteResult>;

/** The page object represents the latest revision of a wiki page. */
export const PageBase = Record({
  /** Page identifier */
  id: Number,

  /** Page title in URL-friendly format */
  key: String,

  /** Page title in reading-friendly format */
  title: String,

  /** Information about the latest revision */
  latest: Record({
    /** Revision identifier for the latest revision */
    id: Number,

    /** Timestamp of the latest revision in [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601) */
    timestamp: String,
  }),

  /** Type of content on the page. See [the content handlers reference](https://www.mediawiki.org/wiki/Content_handlers) for content models supported by MediaWiki and extensions. */
  content_model: String,

  /** Information about the wiki's license */
  license: Record({
    /** URL of the applicable license based on the [$wgRightsUrl](https://www.mediawiki.org/wiki/Manual:$wgRightsUrl) setting */
    url: String,

    /** Name of the applicable license based on the [$wgRightsText](https://www.mediawiki.org/wiki/Manual:$wgRightsText) setting */
    title: String,
  }),
});
export type PageBase = Static<typeof PageBase>;

/** The page object represents the latest revision of a wiki page. */
export const Page = PageBase.And(Record({
  /** API route to fetch the content of the page in HTML */
  html_url: String,
}));
export type Page = Static<typeof Page>;

export const PageWithHtml = PageBase.And(Record({
  /** Latest page content in HTML, following the [HTML 2.1.0 specification](https://www.mediawiki.org/wiki/Specs/HTML/2.1.0) */
  html: String,
}));
export type PageWithHtml = Static<typeof PageWithHtml>;

export const PageWithSource = PageBase.And(Record({
  /** Latest page content in the format specified by the `content_model` property */
  source: String,
}));
export type PageWithSource = Static<typeof PageWithSource>;

export const PageLanguage = Record({
  /** Language code. For Wikimedia projects, see the [site matrix on Meta-Wiki](https://meta.wikimedia.org/wiki/Special:SiteMatrix). */
  code: String,

  /** Translated language name */
  name: String,

  /** Translated page title in URL-friendly format */
  key: String,

  /** Translated page title in reading-friendly format */
  title: String,
});
export type PageLanguage = Static<typeof PageLanguage>;

export const Format = Record({
  /** The file type, one of: BITMAP, DRAWING, AUDIO, VIDEO, MULTIMEDIA, UNKNOWN, OFFICE, TEXT, EXECUTABLE, ARCHIVE, or 3D */
  mediatype: Union(
    Literal("BITMAP"),
    Literal("DRAWING"),
    Literal("AUDIO"),
    Literal("VIDEO"),
    Literal("MULTIMEDIA"),
    Literal("UNKNOWN"),
    Literal("OFFICE"),
    Literal("TEXT"),
    Literal("EXECUTABLE"),
    Literal("ARCHIVE"),
    Literal("3D"),
  ),

  /** File size in bytes or `null` if not available */
  size: Number.Or(Null),

  /** Maximum recommended image width in pixels or `null` if not available */
  width: Number.Or(Null),

  /** Maximum recommended image height in pixels or `null` if not available */
  height: Number.Or(Null),

  /** The length of the video, audio, or multimedia file or `null` for other media types */
  duration: Number.Or(Null),

  /** URL to download the file */
  url: String,
});
export type Format = Static<typeof Format>;

export const WikiFile = Record({
  /** File title */
  title: String,

  /** URL for the page describing the file, including license information and other metadata */
  file_description_url: String,

  /** Object containing information about the latest revision to the file */
  latest: Record({
    /** Last modified timestamp in [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601) format */
    timestamp: String,

    /** Object containing information about the user who uploaded the file */
    user: Record({
      /** User identifier */
      id: String,

      /** Username */
      name: String,
    }),
  }),

  /** Information about the file's preferred preview format */
  preferred: Format,

  /** Information about the file's original format */
  original: Format,
});
export type WikiFile = Static<typeof WikiFile>;

export const FileWithThumbnail = WikiFile.And(Record({
  /** Information about the file's thumbnail format */
  thumbnail: Format,
}));
export type FileWithThumbnail = Static<typeof FileWithThumbnail>;

/** The revision object represents a change to a wiki page. */
export const Revision = Record({
  /** Revision identifier */
  id: Number,

  /** Object containing information about the user that made the edit */
  user: Record({
    /** Username */
    name: String,

    /** User identifier */
    id: Number.Or(Null),
  }),

  /** Time of the edit in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format */
  timestamp: String,

  /** Comment or edit summary written by the editor. For revisions without a comment, the API returns `null` or `""`. */
  comment: String.Or(Null),

  /** Size of the revision in bytes */
  size: Number,

  /** Number of bytes changed, positive or negative, between a revision and the preceding revision (example: `-20`). If the preceding revision is unavailable, the API returns `null`. */
  delta: Number.Or(Null),

  /** Set to true for edits marked as [minor](https://meta.wikimedia.org/wiki/Help:Minor_edit) */
  minor: Boolean,
});
export type Revision = Static<typeof Revision>;

export const RevisionWithPage = Revision.And(Record({
  /** Object containing information about the page */
  page: Record({
    id: Number,
    title: String,
  }),
}));
export type RevisionWithPage = Static<typeof RevisionWithPage>;

export const History = Record({
  /** API route to get the latest revisions */
  latest: String,

  /** Array of 0-20 [revision objects](https://www.mediawiki.org/wiki/API:REST_API/Reference#Revision_object) */
  revisions: Array(Revision),
}).And(Partial({
  /** If available, API route to get the prior revisions */
  older: String,

  /** If available, API route to get the following revisions */
  newer: String,
}));
export type History = Static<typeof History>;

export const ApiError = Record({
  /** [Status code](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) */
  httpCode: Union(
    Literal(200),
    Literal(201),
    Literal(400),
    Literal(403),
    Literal(404),
    Literal(412),
    Literal(415),
    Literal(500),
  ),

  /** Status message */
  httpReason: String,
}).And(Partial({
  /** Object containing error messages as key-value pairs where the key is the [language code](https://www.mediawiki.org/wiki/Manual:Language#Language_code) and the value is the error message. Most endpoints return error messages using this property. */
  messageTranslations: Dictionary(String, "string"),

  /** In cases where `messageTranslations` is not available, this property provides an error message in English */
  message: String,

  /** In the event of an error due to an unsupported content type, this property indicates the requested content type */
  content_type: String,

  /** Internal error code */
  actionModuleErrorCode: String,
}));
export type ApiError = Static<typeof ApiError>;

export const RevisionInfo = Record({
  id: Number,
  slot_role: String,

  /** Array of objects representing section headings */
  sections: Array(Record({
    /** Heading level, 1 through 4 */
    level: Union(Literal(1), Literal(2), Literal(3), Literal(4)),

    /** Text of the heading line, in wikitext */
    heading: String,

    /** Location of the heading, in bytes from the beginning of the page */
    offset: Number,
  })),
});
export type RevisionInfo = Static<typeof RevisionInfo>;

export const Line = Record({
  /** The text of the line, including content from both revisions. For a line containing text that differs between the two revisions, you can use `highlightRanges` to visually indicate added and removed text. For a line containing a new line, the API returns the text as `""` (empty string). */
  text: String,
}).And(Partial({
  /** The line number of the change based on the `to` revision. */
  lineNumber: Number,

  /** An array of objects that indicate where and in what style text should be highlighted to visually represent changes. */
  highlightRanges: Array(Record({
    /** Where the highlighted text should start, in the number of bytes from the beginning of the line. */
    start: Number,

    /** The length of the highlighted section, in bytes. */
    length: Number,

    /** 
     * The type of highlight:
     * - 0 indicates an addition.
     * - 1 indicates a deletion.
     */
    type: Union(Literal(0), Literal(1)),
  })),

  /**
   * Visual indicators to use when a paragraph's location differs between the two revisions. moveInfo objects occur in pairs within the `diff`.
   */
  moveInfo: Array(Record({
    /** The ID of the paragraph described by the diff object. */
    id: String,

    /** 
     * The ID of the corresponding paragraph.
     * - For type 4 diff objects, `linkId` represents the location in the `to` revision.
     * - For type 5 diff objects, `linkId` represents the location in the `from` revision.
     */
    linkId: String,

    /** 
     * A visual indicator of the relationship between the two locations. You can use this property to display an arrow icon within the diff.
     * - 0 indicates that the linkId paragraph is lower on the page than the id paragraph.
     * - 1 indicates that the linkId paragraph is higher on the page than the id paragraph.
     */
    linkDirection: Union(Literal(0), Literal(1)),
  })),
}));
export type Line = Static<typeof Line>;

export const Diff = Record({
  /** Information about the base revision used in the comparison */
  from: RevisionInfo,

  /** Information about the revision being compared to the base revision */
  to: RevisionInfo,

  /** Each object in the `diff` array represents a line in a visual, line-by-line comparison between the two revisions. */
  diff: Array(Line),
});
export type Diff = Static<typeof Diff>;
