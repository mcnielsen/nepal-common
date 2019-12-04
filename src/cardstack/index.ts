/**
 *  A collection of abstract types to facilitate the most common view in the Alert Logic UI world,
 *  the infinite scroll + filters card list.
 *
 *  For the sake of giving these types a common and somewhat unique namespace, these types will refer to them
 *  as a "cardstack", and all types will be prefixed with AlCardstack.
 *
 *  Author: Big Orange Geek <knielsen@alertlogic.com>
 *  Copyright 2019 but almost 2020 Alert Logic, Inc.
 */

/**
 * This is an abstract description of a property.  Many of the individual properties may be omitted from a given instance.
 */
export interface AlCardstackPropertyDescriptor
{
    //  The service or namespace in which the field has meaning (e.g., "iris" or "herald")
    domain:string;

    //  The service-friendly name of the attribute or field
    property:string;

    //  The user-friendly name (e.g., "Scheduled Report" or "Incident")
    caption:string;

    //  The user-friendly plural name
    captionPlural:string;

    //  An array of possible values the property may have (value/caption pairs, plus an optional flag to indicate the filter should be on by default)
    values: {
        value:any;
        caption:string;
        captionPlural:string;
        default?:boolean;
    }[];

    //  Indicates whether or not multiple items from this property can be selected (applies to filterable properties only)
    multiSelect?:boolean;

    //  Arbitrary metadata, such as icon class or entitlement limitations
    metadata:{[property:string]:any};
}

/**
 *  Describes the general characteristics of a given cardstack view.
 */
export interface AlCardstackCharacteristics
{
    /**
     *  Describees the principal entity being described inside a cardstack (e.g., "Scheduled Reports" or "Observations")
     */
    entity: AlCardstackPropertyDescriptor;

    /**
     *  Identifies a set of properties (referenced by ID) that the cardstack's content can be grouped by.
     *  An empty array indicates that grouping is not supported for this cardstack and the group by selector should not be shown.
     */
    groupableBy: string|AlCardstackPropertyDescriptor[];

    /*  Identifies a set of properties (referenced by ID) that the cardstack's content can be sorted by.
     *  An empty array indicates that sorting is not supported for this cardstack and the sort by selector should not be shown.
     */
    sortableBy: string|AlCardstackPropertyDescriptor[];

    /**
     *  Identifies a set of properties (referenced by ID) that the cardstack's content can be filtered by.
     *  An empty array indicates that filtering is not supported for this cardstack, and the filter panel should not be shown.
     */
    filterableBy: string|AlCardstackPropertyDescriptor[];

    /**
     * If provided, indicates that the cards should be grouped into distinct sections based on a given attribute.
     * The captionPlural property of the property descriptor will be used as the header for each section.
     */
    sectionBy?: string|AlCardstackPropertyDescriptor;

    /**
     * A dictionary of property definitions referenced above.
     */
    definitions: {[propertyId:string]:AlCardstackPropertyDescriptor};

    /**
     * If true, indicates that the client should read all available data aggressively.  This is useful for views/entities where aggregation
     * cannot be provided service side and must be tabulated dynamically in the client.
     */
    greedyConsumer?:boolean;
}

/**
 *  Describes an aggregation descriptor for a given cardstack.  An aggregation descriptor is just a nested
 *  dictionary of properties -> values -> total counts.  If a given item is `null` rather than a number, that
 *  indicates that the UI should calculate the aggregation dynamically on the client side.
 */
export interface AlCardstackAggregations
{
    properties:{[property:string]:{
        [value:string]:number|null
    }};
}

/**
 *  Describes a cardstack item, representing a single entity inside the view.
 *  This simple wrapper object contains a caption, a handful of common properties (referenced by the cardstack's characteristics), and
 *  a blob referencing the underlying entity data.
 */
export interface AlCardstackItem<EntityType=any>
{
    /**
     * Each item has a unique identifier, although the format may vary by entity type or even be mixed across systems
     */
    id:string;

    /**
     * Textual caption (h1/title)
     */
    caption:string;

    /**
     * Indicates whether or not the given item is visible/displayed
     */
    visible?:boolean;

    /**
     * Indicates whether or not the given item is opened/expanded
     */
    expanded?:boolean;

    /**
     * Filterable/groupable/sortable properties
     */
    properties:{[property:string]:any};

    /**
     * A reference to the minimial view of the underlying entity (e.g., incident, scheduled_report, observation, etc)
     */
    entity:EntityType;
}

/**
 *  Describes a page of items for display in a cardstack
 */
export interface AlCardstackPage<EntityType=any>
{
    items: AlCardstackItem<EntityType>;
    continuation_token?:string;
    pages_remaining:number;
}

/**
 *  Manages a cardstack view state
 */
export abstract class AlCardstackView<EntityType=any>
{
    public loading:boolean                      =   false;
    public visibleItems:number                  =   0;
    public loadedPages:number                   =   0;
    public remainingPages:number                =   1;
    public cards:AlCardstackItem<EntityType>[]  =   [];

    public textFilter:      RegExp|null                                         =   null;
    public groupingBy:      AlCardstackPropertyDescriptor|null                  =   null;
    public sortingBy:       AlCardstackPropertyDescriptor|null                  =   null;
    public activeFilters:   {[property:string]:AlCardstackPropertyDescriptor}   =   {};

    public aggregations:AlCardstackAggregations = {
        properties: {}
    };

    constructor( public characteristics:AlCardstackCharacteristics ) {
    }

    /**
     * Applies a textual search filter to all properties/entities in the current list, or clears the current filter if `filterPattern` is null.
     * This should cause the `visibleItem` count to be recalculated, possibly triggering a load of further pages of data.
     */
    public abstract applyTextFilter( filterPattern:RegExp|null );

    /**
     * Applies grouping logic to the current view, or clears grouping if `property` is null.
     */
    public abstract applyGroupingBy( descriptor:AlCardstackPropertyDescriptor|null );

    /**
     * Applies sorting logic to the current view, or restores default if `property` is null.
     * Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public abstract applySortBy( descriptor:AlCardstackPropertyDescriptor|null ):boolean;

    /**
     * Applies a filter to the current view.
     * Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public abstract applyFilterBy( descriptor:AlCardstackPropertyDescriptor ):boolean;

    /**
     * Removes a filter from the current view.
     * Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public abstract removeFilterBy( descriptor:AlCardstackPropertyDescriptor ):boolean;

    /**
     * Retrieves the next page of items using the current group/sort criteria.
     */
    public abstract async fetchNextPage();
}

