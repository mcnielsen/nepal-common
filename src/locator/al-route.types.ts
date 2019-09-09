/**
 *  This is a collection of interfaces and types for cross-application routing.
 *
 *  @author McNielsen <knielsen@alertlogic.com>
 *
 *  @copyright 2017 Alert Logic Inc.
 */

import { AlLocatorService } from './al-locator.service';

/**
 * Any navigation host must provide these basic functions
 */
export interface AlRoutingHost
{
    /* Exposes the current URL of the application (required). */
    currentUrl:string;

    /* @deprecated Exposes the effective navigation schema, if available (not required).  Don't use this! */
    schema?:AlNavigationSchema;

    /* Routing parameters */
    routeParameters: {[parameter:string]:string};
    setRouteParameter( parameter:string, value:string ):void;
    deleteRouteParameter( parameter:string ):void;

    /* Named routes - actions that can be reused by multiple menu items or invoked imperatively from code */
    getRouteByName?( routeName:string ):AlRouteDefinition;

    /* Bookmarks - arguably the worst name for a navigation construct I've chosen in years!  But super useful, I swear. */
    setBookmark( bookmarkId:string, route:AlRoute );
    getBookmark( bookmarkId:string ):AlRoute;

    /* Asks the host to execute a given route's action. */
    dispatch(route:AlRoute, params?:{[param:string]:string}):void;

    /* Asks the host to evaluate whether a given routing condition is true or false */
    evaluate(condition:AlRouteCondition):boolean;
}

/**
 * This empty or "null" routing host is provided as a convenience for unit tests,
 * debugging, and placeholder or empty menu structures.
 */
/* tslint:disable:variable-name */
export const AlNullRoutingHost = {
    currentUrl: '',
    routeParameters: {},
    bookmarks: {},
    setRouteParameter: ( parameter:string, value:string ) => {
        this.routeParameters[parameter] = value;
    },
    deleteRouteParameter: ( parameter:string ) => {
        delete this.routeParameters[parameter];
    },
    setBookmark: ( bookmarkId:string, route:AlRoute ) => {
        this.bookmarks[bookmarkId] = route;
    },
    getBookmark: ( bookmarkId:string ) => {
        return this.bookmarks[bookmarkId];
    },
    dispatch: (route:AlRoute) => {},
    evaluate: (condition:AlRouteCondition) => false
};

/**
 *  Conditional expressions
 */
export interface AlRouteCondition
{
    rule?:string;                       //  must be "any", "all", or "none"
    conditions?:AlRouteCondition[];     //  An array of child conditions to evaluate using the indicated rule
    entitlements?:string;               //  An entitlement expression to evaluate
    path_matches?:string;               //  Path matches a given regular expression
    parameters?:string[];               //  An array of route parameters that must be set for the route to be visible/active
}

/**
 *  The action associated with a route.  These are only the most common properties.
 */

export interface AlRouteAction
{
    /**
     *  What type of action does this route have?  Valid types are 'link', 'trigger', and 'callback'
     */
    type:string;

    /**
     * If the route action is 'link' (default), these properties indicate which application (location)
     * and route (path) OR url (fully qualified) the link should point to.
     */
    location?:string;
    path?:string;
    url?:string;

    /**
     * If the type of the action is 'trigger', this is the name of the event to be triggered.
     */
    trigger?:string;

    /**
     * If the type of the action is 'callback', this is the anonymous function that will be executed.
     */
    callback?:{(route:AlRoute,mouseEvent?:any):void};
}

/**
 *  This is an abstract definition for a single menu item or menu container.
 */
export interface AlRouteDefinition {

    /* The caption of the menu item */
    caption:string;

    /* An arbitrary id associated with this menu item.  This is most useful (practically) for retrieving specific menu items by code. */
    id?:string;

    /* An arbitrary bookmark code for this menu item.  This allows a specific submenu to be retrieved and worked with programmatically. */
    bookmarkId?:string;

    /* Arbitrary properties */
    properties?: {[property:string]:any};

    /* The action to perform when the menu item is clicked.
     * If the provided value is a string, it will be treated as a reference to a named route in the current schema. */
    action?:AlRouteAction|string;

    /* A condition that can be evaluated to calculate the `visible` property at any given moment */
    visible?:AlRouteCondition;

    /* Does is match patterns other than its canonical href?  If so, list of patterns relative to the action's site (only applies to action.type == link) */
    matches?:string[];

    /* Nested menu items */
    children?:AlRouteDefinition[];

    /* Behavior inflection: if this item is enabled, enable the parent item and project into its href.  This is useful for top level menu items that should direct to a child route. */
    bubble?:boolean;
}

/**
 * An AlRoute is an instantiated route definition, attached to a routing host, and capable of actually calculating target URLs based on context
 * and handling navigation events.
 */
export class AlRoute {

    /* The route's caption, echoed from its definition but possibly translated */
    caption:string;

    /* The raw data of the route */
    definition:AlRouteDefinition;

    /* Is the menu item visible? */
    visible:boolean = true;

    /* Is the menu item enabled?  This is provided for use by custom menu implementations, and no managed by this module. */
    enabled:boolean = true;

    /* Is the menu item locked?  This prevents refresh cycles from changing its state. */
    locked:boolean = false;

    /* Is the menu item currently activated/expanded?  This will allow child items to be seen. */
    activated:boolean = false;

    /* Parent menu item (if not a top level navigational slot) */
    parent:AlRoute = null;

    /* Child menu items */
    children:AlRoute[] = [];

    /* Link to the routing host, which exposes current routing context, routing parameters, and actions that influence the environment */
    host:AlRoutingHost = null;

    /* Arbitrary properties */
    properties: {[property:string]:any} = {};

    /* Base of target URL */
    baseHREF:string = null;

    /* Cached target URL */
    href:string = null;

    constructor( host:AlRoutingHost, definition:AlRouteDefinition, parent:AlRoute = null ) {
        this.host       =   host;
        this.definition =   definition;
        this.caption    =   definition.caption;
        this.parent     =   parent;
        if ( definition.bookmarkId ) {
            this.host.setBookmark( definition.bookmarkId, this );
        }
        if ( definition.children ) {
            for ( let i = 0; i < definition.children.length; i++ ) {
                this.children.push( new AlRoute( host, definition.children[i], this ) );
            }
        }
        if ( definition.properties ) {
            this.properties = Object.assign( this.properties, definition.properties );      //  definition properties provide the "starting point" for the route's properties, but remain immutable defaults
        }
        if ( parent === null ) {
            //  This effectively performs the initial refresh/state evaluation to occur once, after the top level item has finished populating
            this.refresh( true );
        }
    }

    /**
     * Generates an empty route attached to a null routing host
     */
    public static empty() {
        return new AlRoute( AlNullRoutingHost, { caption: "Nothing", properties: {} } );
    }

    public static link( host:AlRoutingHost, locationId:string, path:string, caption:string = "Link" ) {
        return new AlRoute( host, { caption: caption, action: { type: "link", location: locationId, path: path }, properties: {} } );
    }

    /**
     * Sets an arbitrary property for the route
     */
    setProperty( propName:string, value:any ) {
        if ( value === undefined ) {
            this.deleteProperty( propName );
        } else {
            this.properties[propName] = value;
        }
    }

    /**
     * Deletes a property.  If the immutable route definition contains the same property, it will be
     * restored.
     */
    deleteProperty( propName:string ) {
        if ( this.definition.properties && this.definition.properties.hasOwnProperty( propName ) ) {
            this.properties[propName] = this.definition.properties[propName];
        } else {
            delete this.properties[propName];
        }
    }

    /**
     * Retrieves a property.
     */
    getProperty( propName:string, defaultValue:any = null ):any {
        return this.properties.hasOwnProperty( propName ) ? this.properties[propName] : defaultValue;
    }

    /**
     * Refreshes the state of a given route.
     *
     * @param {boolean} resolve If true, forces the calculated href and visibility properties to be recalculated.
     *
     * @returns {boolean} Returns true if the route (or one of its children) is activated, false otherwise.
     */
    refresh( resolve:boolean = false ):boolean {

        if ( this.locked ) {
            //  If this menu item has been locked, then we won't reevaluate its URL, its visibility, or its activated status.
            //  This lets outside software take "manual" control of the state of a given menu.
            return;
        }

        /* Evaluate visibility */
        this.visible = this.definition.hasOwnProperty( 'visible' ) ? this.evaluateCondition( this.definition.visible ) : true;

        /* Evaluate children recursively, and deduce activation state from them. */
        let childActivated = this.children.reduce(  ( activated, child ) => {
                                                        return child.refresh( resolve ) || activated;
                                                    },
                                                    false );

        /* Evaluate fully qualified href, if visible/relevant */
        let action:AlRouteAction = this.getRouteAction();
        if ( action ) {
            if ( this.visible && ( resolve || this.href === null ) && action.type === 'link' ) {
                if ( ! this.evaluateHref( action ) ) {
                    return this.disable();
                }
            }
        }

        this.activated = childActivated;

        //  activation test for path match
        if ( ! this.activated ) {
            this.evaluateActivation();
        }

        //  bubble to parent?
        if ( this.definition.bubble && this.parent ) {
            this.parent.activated = this.parent.activated || this.activated;
            this.parent.href = this.href;
        }

        return this.activated;
    }

    /**
     * Disables a route
     */
    disable():boolean {
        this.activated = false;
        this.visible = false;
        return false;
    }

    /**
     * "Executes" a route.  This invokes the `dispatch` method on whatever routing host was provided to the menu at load time.
     */
    dispatch() {
        this.refresh( true );
        return this.host.dispatch( this );
    }

    /**
     * Retrieves the full URL for a route, if applicable.
     */
    toHref() {
        this.refresh( true );
        return this.href;
    }

    /**
     * Diagnostic method for logging the current hierarchy and state of a given navigational tree.
     */
    summarize( showAll:boolean = true, depth:number = 0 ) {
        if ( showAll || this.visible ) {
            console.log( "    ".repeat( depth ) + `${this.definition.caption} (${this.visible ? 'visible' : 'hidden'}, ${this.activated ? 'activated' : 'inactive'})` + ( this.href ? ' - ' + this.href : '' ) );
            for ( let i = 0; i < this.children.length; i++ ) {
                this.children[i].summarize( showAll, depth + 1 );
            }
        }
    }

    /**
     *---- Helper Methods ---------------------------------------------
     */

    /**
     * Evaluates the HREF for an route with action type 'link'
     */
    evaluateHref( action:AlRouteAction ):boolean {
        if ( action.url ) {
            this.href = action.url;
            return true;
        }
        let node = AlLocatorService.getNode( action.location );
        if ( ! node ) {
            console.warn(`Warning: cannot link to unknown location '${action.location}' in menu item '${this.caption}` );
            return false;
        }

        this.baseHREF = AlLocatorService.resolveNodeURI( node );
        let path = action.path ? action.path : '';
        let missing = false;
        //  Substitute route parameters into the path pattern; fail on missing required parameters,
        //  ignore missing optional parameters (denoted by question mark), and trim any trailing slashes and spaces.
        path = path.replace( /\:[a-zA-Z_\?]+/g, match => {
                let variableId = match.substring( 1 );
                let required = true;
                if ( variableId[variableId.length-1] === '?' ) {
                    required = false;
                    variableId = variableId.substring( 0, variableId.length - 1 );
                }
                if ( this.host.routeParameters.hasOwnProperty( variableId ) ) {
                    return this.host.routeParameters[variableId];
                } else if ( required ) {
                    missing = true;
                    return `:${variableId}`;
                } else {
                    return '';
                }
            } )
            .replace( /[ \/]+$/g, '' );

        this.href = this.baseHREF + path;
        return ! missing;
    }

    /**
     * Evaluates the activation state of the route
     */
    evaluateActivation():boolean {
        if ( ! this.href ) {
            return false;
        }
        if ( this.host.currentUrl.indexOf( this.baseHREF ) === 0 ) {
            // remove parameters from href
            let noParamsHref = this.href.indexOf('?') === -1
                                    ? this.href
                                    : this.href.substring( 0, this.href.indexOf('?') );
            if ( this.host.currentUrl.indexOf( noParamsHref ) === 0 ) {
                //  If our full URL *contains* the current URL, we are activated
                this.activated = true;
            } else if ( this.definition.matches ) {
                //  If we match any other match patterns, we are activated
                for ( let m = 0; m < this.definition.matches.length; m++ ) {
                    let regexp = ( "^" + this.baseHREF + this.definition.matches[m] + "$" ).replace("/", "\\/" );
                    let comparison = new RegExp( regexp );
                    if ( comparison.test( this.host.currentUrl ) ) {
                        this.activated = true;
                    }
                }
            }
        }
        return this.activated;
    }

    /**
     * Evaluates a single conditional against this route
     */
    evaluateCondition( condition:AlRouteCondition|boolean ):boolean {
        if ( typeof( condition ) === 'boolean' ) {
            return condition;
        }
        if ( condition.rule && condition.conditions ) {
            //  This condition is a group of other conditions -- evaluate it internally
            let total = 0;
            let passed = 0;
            condition.conditions.forEach( child => {
                total++;
                passed += this.evaluateCondition( child ) ? 1 : 0;
            } );
            if ( condition.rule === "any" ) {
                return ( passed > 0 ) ? true : false;
            } else if ( condition.rule === "all" ) {
                return ( passed === total ) ? true : false;
            } else {
                return ( passed === 0 ) ? true : false;
            }
            return false;
        }

        let truthful = true;
        if ( condition.parameters ) {
            //  Evaluates true only if all of the referenced route parameters exist
            truthful = truthful && condition.parameters.reduce( ( present, parameterName ) => {
                    return present && this.host.routeParameters.hasOwnProperty( parameterName );
                }, true );
        }
        if ( condition.path_matches ) {
            //  Evaluates true only if the current path matches a given regular expression
            truthful = truthful && this.evaluatePathMatch( condition.path_matches );
        }
        if ( condition.entitlements ) {
            //  This condition refers to entitlement or other externally managed data -- ask the host to evaluate it.
            truthful = truthful && this.host.evaluate( condition );
        }
        return truthful;
    }

    /**
     * Determines whether a path pattern matches the current URL
     */
    evaluatePathMatch( pathMatches:string ) {
        let pattern = "^.*" + pathMatches.replace(/[{}()|[\]\\\/]/g, '\\$&') + "$";
        let comparison = new RegExp( pattern );
        return comparison.test( this.host.currentUrl );
    }

    /**
     * Retrieves the route's action, which may be a shared "named" route or embedded directly into the route's definition.
     */
    getRouteAction():AlRouteAction {
        if ( typeof( this.definition.action ) === 'string' ) {
            if ( typeof( this.host.getRouteByName ) === 'function' ) {
                const definition:AlRouteDefinition = this.host.getRouteByName( this.definition.action );
                if ( definition && definition.action ) {
                    return definition.action as AlRouteAction;
                }
            }
            return null;
        } else if ( typeof( this.definition.action ) === 'object' ) {
            return this.definition.action;
        }
        return null;
    }

    /**
     * Updates the route to use a specified action
     */
    setAction( action:AlRouteAction ) {
        this.definition.action = action;
    }

    /**
     * Updates the route to use a specific callback action.
     */
    setCallback( callback?:{(route:AlRoute,mouseEvent?:any):void} ) {
        this.setAction( {
            type: 'callback',
            callback: callback
        } );
    }

    /**
     * Retrieves a nested child route by matching bookmarks, captions, IDs, or numerical indices.
     */
    findChild( idPath:string|string[] ):AlRoute {
        const path = typeof( idPath ) === 'string' ? idPath.split("/") : idPath;
        const childId = path[0];
        let child:AlRoute;

        if ( childId[0] === '#' ) {
            //  Retrieve by numerical index
            let childIndex = parseInt( childId.substring( 1 ), 10 );
            child = this.children.length > childIndex ? this.children[childIndex] : null;
        } else {
            if ( typeof( idPath ) === 'string' ) {
                child = this.host.getBookmark( childId );
            }
            if ( ! child ) {
                child = this.children ? this.children.find( child => child.definition.caption === childId || child.definition.id === childId ) : null;
            }
        }
        if ( path.length > 1 ) {
            return child ? child.findChild( path.slice( 1 ) ) : null;
        }
        return child || null;
    }
}

/**
 * This is a top-level interface for the structure of a schema document, which is a set of compiled menus and behavioral rules.
 */
export interface AlNavigationSchema
{
    name: string;
    description: string;
    menus: {[menuId:string]:AlRouteDefinition};
    namedRoutes: {[routeName:string]:AlRouteDefinition};
}
