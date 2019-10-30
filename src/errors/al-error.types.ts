/**
 * A collection of classed error types.
 */

/**
 * This error should be used when an HTTP 5xx response (or other general error) is received
 * from an internal API.
 */

export class AlAPIServerError extends Error
{
    constructor( message:string,
                 public serviceName:string,
                 public statusCode:number ) {
        super( message );
    }
}

/**
 * The AlResponseValidationError is intended to alert of unexpected responses from an internal API.
 * These responses need to be identified separately from other errors so that the relevant
 * system health checks or communication with an appropriate backend team can be organized in response.
 * Please note that this should NOT be used to handler general server-side failures; please see AlAPIServerError
 * for that error condition.
 */
export class AlResponseValidationError extends Error
{
    constructor( message:string, public errors:any[] = [] ) {
        super( message );
        console.error( message, errors );
    }
}

/**
 * Used to indicate an invalid request to a service or API.
 *
 * @param message The description of the error
 * @param inputType Which type of input was malformed (e.g., query parameter, header, data)
 * @param inputProperty Which data element was malformed (e.g., "filter", "X-AIMS-Auth-Token", ".data.accounts.id")
 * @param description Additional descriptive content.
 */
export class AlBadRequestError extends Error
{
    constructor( message:string,
                 public inputType?:string,
                 public inputProperty?:string,
                 public description?:string ) {
        super( message );
    }
}

/**
 * Used to indicate that the current actor is not authenticated.
 *
 * @param message The description of the error
 * @param authority Which authentication authority made the authentication state claim.  Typically, this will be AIMS.
 */
export class AlUnauthenticatedRequestError extends Error
{
    constructor( message: string,
                 public authority:string ) {
        super( message );
    }
}

/**
 * Used to indicate that the current actor is not authorized to perform a given action.
 *
 * @param message A general description of the error or error context.
 * @param resource The resource that the actor is not authorized to access.
 */
export class AlUnauthorizedRequestError extends Error
{
    constructor( message: string,
                 public resource:string ) {
        super( message );
    }
}

