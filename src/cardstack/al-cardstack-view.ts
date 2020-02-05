import {
    AlCardstackPropertyDescriptor,
    AlCardstackValueDescriptor,
    AlCardstackCharacteristics,
    AlCardstackAggregations,
    AlCardstackItemProperties,
    AlCardstackItem,
} from './types';

/**
 *  Manages a cardstack view state
 */
export abstract class AlCardstackView< EntityType=any,
                                       PropertyType extends AlCardstackItemProperties=any,
                                       CharacteristicsType extends AlCardstackCharacteristics = AlCardstackCharacteristics>
{
    public characteristics?:CharacteristicsType                                 =   undefined;  //  Characteristics of the view: fields, types, behaviors, etc.

    public loading:boolean                                                      =   false;      //  Indicates whether or not the view is currently loading
    public verbose:boolean                                                      =   false;      //  Print (maybe) useful console output for debugging purposes

    public loadedPages:number                                                   =   0;          //  Number of pages currently retrieved
    public remainingPages:number                                                =   1;          //  Number of pages of data remaining (or 1, if unknown); 0 when load is complete/EOS

    public cards:AlCardstackItem<EntityType>[]                                  =   [];         //  All cards loaded, both visible and invisible, in current sort order
    public visibleCards:number                                                  =   0;          //  Number of cards currently visible in view

    public textFilter:      RegExp|null                                         =   null;       //  Regular expression to filter results with (deprecated?)
    public groupingBy:      AlCardstackPropertyDescriptor|null                  =   null;       //  Grouping property
    public sortingBy:       AlCardstackPropertyDescriptor|null                  =   null;       //  Sortation property
    public sortOrder:       string                                              =   "ASC";      //  Sortation direction, either "ASC" or "DESC".  Yes, "sortation" is a real word ;-)
    public dateRange:       Date[]                                              =   [];

    //  Defines which filters are currently "active"
    public activeFilters:   {[property:string]:{[valueKey:string]:AlCardstackValueDescriptor}} = {};

    //  If defined, indicates the view has failed to load and optionally provides description and details of error
    public error?: { description?:string; details?:any; }                       =   undefined;

    //  Aggregation data
    public aggregations:AlCardstackAggregations = {
        properties: {}
    };

    constructor( characteristics?:CharacteristicsType ) {
        if ( characteristics ) {
            this.normalizeCharacteristics( characteristics );
        }
    }

    /**
     * Starts loading the view and digesting data
     */
    public async start() {
        this.loading = true;
        if ( ! this.characteristics ) {
            if ( ! this.generateCharacteristics ) {
                throw new Error("Usage error: AlCardstackView extensions must either be constructed with characteristics or provide a `generateCharacteristics` method." );
            }
            const characteristics = await this.generateCharacteristics();
            this.normalizeCharacteristics( characteristics );
        }
        let entities = await this.fetchData( true );
        this.cards = [];
        this.ingest( entities );
        if ( this.verbose ) {
            console.log( `After start: ${this.describeFilters()} (${this.visibleCards} visible)` );
        }
        this.loading = false;
    }

    /**
     * Starts loading next batch data into view
     */
    public async continue() {
        this.loading = true;
        let entities = await this.fetchData( false );
        this.ingest( entities );
        if ( this.verbose ) {
            console.log( `After continue: ${this.describeFilters()} (${this.visibleCards} visible), with ${this.remainingPages} page(s) of data remaining.` );
        }
        if ( this.characteristics && this.characteristics.greedyConsumer && this.remainingPages > 0 ) {
            //  In greedy consumer mode, we essentially retrieve the entire dataset sequentially as part of the load cycle
            await this.continue();
        }
        this.loading = false;
    }

    public getProperty( propertyId:string|AlCardstackPropertyDescriptor ):AlCardstackPropertyDescriptor {
        if ( typeof( propertyId ) === 'object' ) {
            return propertyId;
        }
        if ( this.characteristics && ! this.characteristics.definitions.hasOwnProperty( propertyId ) ) {
            throw new Error(`Internal error: cannot access undefined property '${propertyId}'` );
        }
        if(this.characteristics){
            return this.characteristics.definitions[propertyId];
        }
        throw new Error(`Internal error: cannot access undefined property '${propertyId}'` );
    }

    public getValue( propertyId:string|AlCardstackPropertyDescriptor, value:any ):AlCardstackValueDescriptor {
        let propDescriptor = typeof( propertyId ) === 'string' ? this.getProperty( propertyId ) : propertyId;
        if ( ! propDescriptor.hasOwnProperty( 'values' ) || propDescriptor.values.length === 0 ) {
            throw new Error(`The property '${propertyId}' does not have a dictionary of discrete values.`);
        }
        const valueDescriptor = propDescriptor.values.find( v => v.value === value || v.valueKey === value );
        if ( ! valueDescriptor ) {
            throw new Error(`The property '${propertyId}' does not have a discrete value '${value.toString()}'` );
        }
        return valueDescriptor;
    }

    /**
     *  Applies a textual search filter to all properties/entities in the current list, or clears the current filter if `filterPattern` is null.
     *  This should cause the `visibleItem` count to be recalculated, possibly triggering a load of further pages of data.
     */
    public applyTextFilter( filterPattern:RegExp|null ):boolean {
        this.textFilter = filterPattern;
        this.loadMore();
        return true;
    }

    /**
     *  Applies grouping logic to the current view, or clears grouping if `property` is null.
     */
    public applyGroupingBy( descriptor:AlCardstackPropertyDescriptor|null ):boolean {
        if ( this.verbose ) {
            console.log("Placeholder", descriptor );
        }
        return true;
    }

    /**
     *  Applies sorting logic to the current view, or restores default if `property` is null.
     *  This is the default implementation, which can be called if the deriving class doesn't implement OR wants to call into the super class.
     *  Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public applySortBy( descriptor:AlCardstackPropertyDescriptor, order:string = "DESC" ):boolean {
        this.cards.sort( ( a, b ) => {
            let pa = a.properties;
            let pb = b.properties;
            if ( typeof( pa[descriptor.property] ) === 'string' && typeof( pb[descriptor.property] ) === 'string' ) {
                return pa[descriptor.property].localeCompare( pb[descriptor.property] );
            } else if ( typeof( pa[descriptor.property] ) === 'number' && typeof( pb[descriptor.property] ) === 'number' ) {
                if ( order === 'ASC' ) {
                    return pa[descriptor.property] - pb[descriptor.property];
                } else {
                    return pb[descriptor.property] - pa[descriptor.property];
                }
            } else {
                throw new Error("Inconsistent property normalization: properties are not string or number, or are mixed." );
            }
        } );
        return false;
    }

    /**
     *  Applies a filter to the current view.
     *  Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public applyFilterBy( descriptor:AlCardstackValueDescriptor ):boolean {
        const propertyName = descriptor.property;
        if ( ! this.activeFilters.hasOwnProperty( propertyName ) ) {
            this.activeFilters[propertyName] = {};
        }
        this.activeFilters[propertyName][descriptor.valueKey] = descriptor;
        this.cards = this.cards.map( c => this.evaluateCardState( c ) );
        this.visibleCards = this.cards.reduce( ( count, card ) => count + ( card.visible ? 1 : 0 ), 0 );
        if ( this.verbose ) {
            console.log( `After filter applied: ${this.describeFilters()} (${this.visibleCards} visible)` );
        }
        return false;
    }

    /**
     *  Removes a filter from the current view.
     *  Returning `true` indicates that the current list of items needs to be flushed and data retrieval should start from scratch.
     */
    public removeFilterBy( descriptor:AlCardstackValueDescriptor ):boolean {
        const propertyName = descriptor.property;
        if ( ! this.activeFilters.hasOwnProperty( propertyName ) ) {
            return false;
        }
        delete this.activeFilters[propertyName][descriptor.valueKey];
        if ( Object.keys( this.activeFilters[propertyName] ).length === 0 ) {
            delete this.activeFilters[propertyName];
        }
        this.cards = this.cards.map( c => this.evaluateCardState( c ) );
        if ( this.verbose ) {
            console.log( `After filter removed: ${this.describeFilters()} (${this.visibleCards} visible)` );
        }
        return false;
    }

    /**
     *  Retrieves the next page of items using the current group/sort criteria.  The derived class must provide an implementation of this method,
     *  and it should set the `remainingPages` value when it completes execution.
     */
    public abstract async fetchData( initialLoad:boolean ):Promise<EntityType[]>;

    /**
     *  Given an entity instance, allows the deriving class to populate a properties object -- which may be correlated or extracted or mapped as necessary
     *  from other data -- that can be used to sort, filter, group, and segment by.
     */
    public abstract deriveEntityProperties( entity:EntityType ):PropertyType;

    /**
     *  Optional method to generate characteristics asynchronously, after constructor has executed.
     */
    public async generateCharacteristics?():Promise<CharacteristicsType>;

    /**
     *  Refresh view after a change has been applied.
     */
    public loadMore() {
        this.visibleCards = this.cards.reduce( ( count, card ) => count + ( card.visible ? 1 : 0 ), 0 );
        if ( this.visibleCards < 20 && this.remainingPages > 0 ) {
            this.fetchData( false ).then( batch => {
                let newData = batch.map( entity => {
                    const properties = this.deriveEntityProperties( entity );
                    return {
                        entity,
                        properties,
                        id: properties.id,
                        caption: properties.caption
                    };
                } );
                this.cards.push( ...newData );
            } );
        }
    }

    protected ingest( entities:EntityType[] ):number {
        let newData = entities.map( entity => {
            let properties = this.deriveEntityProperties( entity );
            return {
                properties,
                entity,
                id: properties.id,
                caption: properties.caption
            };
        } );
        this.cards.push( ...newData );
        this.cards = this.cards.map( c => this.evaluateCardState( c ) );
        this.visibleCards = this.cards.reduce( ( count, card ) => count + ( card.visible ? 1 : 0 ), 0 );
        return this.visibleCards;
    }

    /**
     *  Method to determine visibility of an individual card item based on the current set of active filters.
     */
    protected evaluateCardState( card:AlCardstackItem<EntityType,PropertyType> ):AlCardstackItem<EntityType,PropertyType> {
        card.visible = true;
        let filterProperties = Object.keys( this.activeFilters );
        if ( filterProperties.length === 0 ) {
            return card;
        }
        filterProperties.find( property => {
            if ( ! card.properties.hasOwnProperty( property ) || typeof( ( card.properties as any)[property] ) === 'undefined' ) {
                card.visible = false;
                return true;        //  terminate iteration
            }
            let cardPropValue = ( card.properties as any )[property];
            let matched = Object.values( this.activeFilters[property] ).find( valDescriptor => {
                return valDescriptor.value === cardPropValue ? true : false;
            } );
            if ( ! matched ) {
                card.visible = false;
                return true;        //  terminate iteration
            }
            return false;
        } );
        return card;
    }

    /**
     *  Utility method to normalize and validate an input characteristics definitions, and then store it
     *  to the instance's `characteristics` property.
     */
    protected normalizeCharacteristics( characteristics:CharacteristicsType ) {
        try {
            characteristics.groupableBy         =   characteristics.groupableBy || [];
            characteristics.sortableBy          =   characteristics.sortableBy || [];
            characteristics.filterableBy        =   characteristics.filterableBy || [];
            characteristics.definitions         =   characteristics.definitions || {};
            characteristics.filterValueLimit    =   characteristics.filterValueLimit || 10;
            characteristics.filterValueIncrement=   characteristics.filterValueIncrement || 10;
            this.characteristics = characteristics;
            let activeFilters:{[valueKey:string]:AlCardstackValueDescriptor} = {};
            const properties = [
                ...characteristics.sortableBy,
                ...characteristics.filterableBy,
                ...characteristics.groupableBy
            ];

            properties.forEach( descriptor => {
                const propDescriptor = this.resolveDescriptor( descriptor );
                if ( ! propDescriptor.values ) {
                    propDescriptor.values = [];
                }
                propDescriptor.values.forEach( valDescriptor => {
                    valDescriptor.property = propDescriptor.property;
                    if ( ! valDescriptor.hasOwnProperty( "valueKey" ) ) {
                        valDescriptor.valueKey = `${propDescriptor.property}-${valDescriptor.value.toString()}`;
                    }
                    if ( valDescriptor.default ) {
                        activeFilters[valDescriptor.valueKey] = valDescriptor;
                    }
                } );
            } );

        } catch( e ) {
            throw new Error(`Failed to normalize characteristics object: ${e.message}` );
        }
    }

    protected resolveDescriptor( descriptor:string|AlCardstackPropertyDescriptor ):AlCardstackPropertyDescriptor {
        if ( typeof( descriptor ) === 'string' ) {
            if ( this.characteristics && this.characteristics.definitions.hasOwnProperty( descriptor ) ) {
                return this.characteristics.definitions[descriptor];
            } else {
                throw new Error(`sort property descriptor '${descriptor}' not found in definitions dictionary.` );
            }
        } else {
            if ( this.characteristics && this.characteristics.definitions.hasOwnProperty( descriptor.property ) ) {
                throw new Error(`there are multiple descriptors for the property '${descriptor.property}'; these should be consolidated into the definitions dictionary.` );
            }
            if(this.characteristics){
                this.characteristics.definitions[descriptor.property] = descriptor;
            }
        }
        return descriptor;
    }

    protected describeFilters():string {
        let properties = Object.keys( this.activeFilters );
        let description = '';
        if ( properties.length === 0 ) {
            return "no filter applied";
        }
        properties.forEach( propKey => {
            const propDescriptor = this.getProperty( propKey );
            let values = Object.values( this.activeFilters[propKey] );
            description += `${description.length===0?"":" AND "}`;
            if ( values.length === 1 ) {
                description += `${propDescriptor.caption} == "${values[0].caption}"`;
            } else {
                description += `${description}${description.length===0?"":" AND "}${propDescriptor.caption} == "${values[0].caption}"`;
            }
        } );
        return description;
    }
}
