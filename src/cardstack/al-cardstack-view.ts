import {
    AlCardstackPropertyDescriptor,
    AlCardstackCharacteristics,
    AlCardstackAggregations,
    AlCardstackItem
} from './types';

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

