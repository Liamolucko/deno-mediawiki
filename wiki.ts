import * as path from "https://deno.land/std/path/mod.ts";
import type {
  ActionsError,
  ActionsRevision,
  LegacyActionsError,
  QueryResponse,
  ActionsPage,
} from "./actions-api-types.d.ts";
import { AsyncPage } from "./page.ts";
import type {
  ApiError,
  CompleteResult,
  Diff,
  FileWithThumbnail,
  Revision,
  SearchResult,
  RevisionWithPage,
} from "./rest-api-types.d.ts";
import { AsyncRevision } from "./revision.ts";

type AsyncProxy<T> = { [P in keyof T]: Promise<T[P]> } & Promise<T>;
function AsyncProxy<T>(target: Promise<T>): AsyncProxy<T> {
  return new Proxy(target, {
    get(target, prop: keyof T | keyof Promise<T>) {
      if (
        prop === "then" || prop === "catch" || prop === "finally" ||
        prop === Symbol.toStringTag
      ) {
        return target[prop as keyof typeof target];
      } else {
        return target.then((value) => value[prop]);
      }
    },
  }) as { [P in keyof T]: Promise<T[P]> } & Promise<T>;
}

function isRestError(response: any): response is ApiError {
  return typeof response.httpCode !== "undefined";
}

function handleRestError<T extends object>(response: ApiError | T): T {
  if (!isRestError(response)) return response;

  throw Error(
    response.messageTranslations?.["en"] ?? response.message ??
      response.httpCode.toString(),
  );
}

function isActionsError(
  response: any,
): response is LegacyActionsError | ActionsError {
  return typeof response.error !== "undefined" ||
    typeof response.errors !== "undefined";
}

function isLegacyError(
  error: LegacyActionsError | ActionsError,
): error is LegacyActionsError {
  return typeof (error as LegacyActionsError).error !== "undefined";
}

function handleActionsError<T extends object>(
  response: (LegacyActionsError | ActionsError) | T,
): T {
  if (!isActionsError(response)) return response;

  throw Error(
    isLegacyError(response) ? response.error.info : response.errors[0].text,
  );
}

/**
 * A wrapper object for a wiki at a given url.
 */
export class Wiki {
  url: string;
  apiUrl: string;
  polyfilled: boolean;

  private initialized = false;

  /**
   * Creates a wiki object from its API url
   * @param url The path to the wiki's Mediawiki installation or the API directly, 
   * e.g. https://en.wikipedia.org/w or https://en.wikipedia.org/w/rest.php
   * @param token OAuth token to use for authentication
   */
  constructor(url: string, public token?: string) {
    // Find path of mediawiki installation and user's chosen API, if any
    const [mediawikiPath, api] = url.split(/\/?(?=(?:(?:rest|api)\.php)?\/?$)/);

    this.url = mediawikiPath;
    this.polyfilled = api === "api.php";
    this.apiUrl = path.join(
      this.url,
      this.polyfilled ? "api.php" : "rest.php/v1",
    );
  }

  /**
   * Checks which APIs are available and validates url. Automatically called on first request.
   */
  async init() {
    if (this.initialized) return;

    if (
      (await fetch(path.join(this.apiUrl, "search/page?q=test"))).status === 404
    ) {
      // If they've already chosen the Actions API and it's not there, throw
      if (this.polyfilled) throw Error("Invalid API url");

      this.polyfilled = true;
      this.apiUrl = path.join(this.url, "api.php");

      // If neither the REST or Actions API are there, throw
      if (
        (await fetch(this.apiUrl)).status === 404
      ) {
        throw Error("Invalid API url");
      }
    }

    this.initialized = true;
  }

  async convertRevision(revision: ActionsRevision): Promise<Revision>;
  async convertRevision(
    revision: ActionsRevision,
    page: ActionsPage,
  ): Promise<RevisionWithPage>;
  async convertRevision(
    revision: ActionsRevision,
    page?: ActionsPage,
  ): Promise<Revision | RevisionWithPage> {
    return {
      id: revision.revid,
      timestamp: revision.timestamp,
      minor: revision.minor,
      size: revision.size,
      comment: revision.comment,
      user: {
        id: revision.userid || null,
        name: revision.user,
      },
      delta: revision.parentid !== 0
        ? await this.actionsRequest(
          {
            action: "query",
            revids: revision.parentid,
            prop: "revisions",
            rvprop: "size",
          },
        ).then(({ query }: QueryResponse) => revision.size - query.pages[0].revisions[0].size)
        : null,
      ...(typeof page !== "undefined" &&
        { page: { id: page.pageid, title: page.title } }),
    };
  }

  /** 
   * Low-level REST API command. NOT POLYFILLED!
   */
  async request(
    url: string,
    params: Record<string, string | number | string[] | undefined> = {},
    init?: RequestInit,
  ) {
    return fetch(
      `${path.join(this.apiUrl, url)}?${
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter((param): param is [string, string | number | string[]] => typeof param[1] !== "undefined")
              .map(([key, value]) => [
                key,
                typeof value === "string" ? value : typeof value === "number"
                  ? value.toString()
                  : value.join("|"),
              ]),
          ),
        ).toString()
      }`,
      init,
    )
      .then((response) => response.json().catch(() => console.log(response)))
      .then(handleRestError);
  }

  /** 
   * Low-level Actions API command.
   */
  async actionsRequest(
    params: Record<string, string | number | string[] | undefined> = {},
    init?: RequestInit,
  ) {
    return fetch(
      `${this.apiUrl}?${new URLSearchParams({
        format: "json",
        formatversion: "2",
        errorformat: "plaintext",
        ...Object.fromEntries(
          Object.entries(params)
            .filter((param): param is [string, string | number | string[]] => typeof param[1] !== "undefined")
            .map(([key, value]) => [
              key,
              typeof value === "string" || typeof value === "undefined"
                ? value
                : typeof value === "number"
                ? value.toString()
                : value.join("|"),
            ]),
        ),
      })}`,
      init,
    )
      .then((response) => response.json())
      .then(handleActionsError);
  }

  // Polyfills

  /** WIP */
  private async searchPolyfill(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: SearchResult[] }> {
    return this.actionsRequest({
      action: "query",
      list: "search",
      srsearch: q,
      srlimit: limit,
    });
  }

  private async filePolyfill(title: string, thumbnails = true, thumbsize = 1000000) {
    const page = await this.actionsRequest({
      action: "query",
      titles: title,
      prop: ["imageinfo", "pageimages"],
      iiprop: [
        "timestamp",
        "user",
        "userid",
        "size",
        "url",
        "mediatype",
      ],
      piprop: ["thumbnail", "name", "original"],
      pithumbsize: thumbsize,
    }).then(({ query }: QueryResponse) => query.pages[0]);

    const imageInfo = page.imageinfo[0];

    const original = {
      mediatype: imageInfo.mediatype,
      size: imageInfo.size,
      width: imageInfo.width || null, // In this case I specifically want 0 to become null
      height: imageInfo.height || null,
      duration: imageInfo.duration ?? null,
      url: (page.original?.source ?? imageInfo.url).split(/:(?=\/\/)/)[1],
    };

    return {
      title: (imageInfo.canonicaltitle ?? page.title).split(/File:/)[1],
      file_description_url: imageInfo.descriptionurl.split(/:(?=\/\/)/)[1],
      latest: {
        timestamp: imageInfo.timestamp,
        user: { id: imageInfo.userid, name: imageInfo.user },
      },

      // TODO: I couldn't figure out how to get this, so I'm just copying the original for now
      preferred: original,

      original,

      ...(thumbnails && {
        thumbnail: typeof page.thumbnail !== "undefined"
          ? {
            ...original,
            url: page.thumbnail.source.split(/:(?=\/\/)/)[1],
            ...(original.width !== null &&
              { width: page.thumbnail.width, height: page.thumbnail.height }),
          }
          : original,
      }),
    };
  }

  /**
   * Searches wiki page titles and contents for the provided search terms, and returns matching pages.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async search(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: SearchResult[] }> {
    if (!this.initialized) await this.init();

    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    return this.request(
      "search/page",
      { q, limit: limit.toString() },
    );
  }

  /** 
   * Searches wiki page titles, and returns matches between the beginning of a title and the provided search terms. You can use this endpoint for a typeahead search that automatically suggests relevant pages by title.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async complete(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: CompleteResult[] }> {
    if (!this.initialized) await this.init();

    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    return this.request(
      "search/title",
      { q, limit: limit.toString() },
    );
  }

  /**
   * Returns a `Page` object with the given key.
   * 
   * You can access any of its properties through async property accessors or by calling fetch() which returns an object with all of its computed properties.
   * 
   * @param title The title of the page.
   * 
   * ```typescript
   * console.log(await page.title)
   *
   * // OR
   *
   * let data = await page.fetch()
   * console.log(data.title)
   * ```
   */
  page(title: string) {
    return new AsyncPage(this, title);
  }

  /**
   * Returns information about a file, including links to download the file in thumbnail, preview, and original formats.
   * @param title File title
   */
  async file(title: string) {
    if (!this.initialized) await this.init();

    return AsyncProxy<FileWithThumbnail>(this.request(`file/${title}`));
  }

  /** 
   * Returns details for an individual revision.
   * 
   * It can also be chained for the effect of `compare`:
   * ```typescript
   * await wiki.revision(42).compare(43)
   * // Is equivalent to
   * await wiki.compare(42, 43)
   * ```
   */
  revision(id: number) {
    return new AsyncRevision(this, id);
  }

  /** 
   * Returns data that lets you display a line-by-line comparison of two revisions. (See [an example](https://en.wikipedia.beta.wmflabs.org/w/index.php?diff=388864&oldid=388863&title=Main_Page&type=revision).) Only text-based wiki pages can be compared. 
   * @param from Revision identifier to use as the base for comparison
   * @param to Revision identifier to compare to the base
   */
  async compare(from: number | string, to: number | string): Promise<Diff> {
    if (!this.initialized) await this.init();

    return this.request(`revision/${from}/compare/${to}`);
  }
}

export default Wiki;
