/**
 * This is not a comprehensive list, just what I needed to polyfill the REST API
 */

export interface LegacyActionsError {
  error: {
    code: string;
    info: string;
    docref: string;
  };
}

export interface ActionsError {
  errors: Array<{
    code: string;
    text: string;
    module: string;
  }>;
  docref: string;
  servedby: string;
}
