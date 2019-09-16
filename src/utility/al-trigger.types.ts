/**
 *  This is a base class for all hook executions, providing some basic information about
 *  the context in which the hook is executing and a few utility methods for interpreting
 *  sets of responses.
 */

export class AlTriggeredEvent
{

    public eventTypeName:string;
    public responses:any[] = [];

    constructor( syntheticName?:string ) {
        this.eventTypeName = syntheticName || this.constructor.name;
    }

    /**
     * Retrieves type name
     */
    public getEventType() {
        return this.eventTypeName;
    }

    /**
     *  Allows hooks to provide feedback/responses to the triggering agent
     */
    public respond( response:any ) {
        this.responses.push( response );
    }

    /**
     *  Retrieves the first response (or returns undefined), removing it from the list of responses.
     */
    public response():any {
        return this.responses.shift();
    }

    /**
     *  Returns true if any response matches the given value, or false otherwise.
     */
    public anyResponseEquals( targetValue:any ):boolean {
        return this.responses.reduce(   ( accumulated, response ) => {
                                            return (accumulated || response === targetValue);
                                        },
                                        false );
    }

    /**
     *  Returns true if the given callback returns true for any of the responses, or false otherwise.
     */
    public anyResponseWith( checkCallback:{(responseValue:any):boolean} ):boolean {
        return this.responses.reduce(   ( accumulated, response ) => {
                                            return (accumulated || checkCallback(response));
                                        },
                                        false );
    }
}

export declare type AlTriggeredEventCallback = {(event:AlTriggeredEvent):void|boolean};

export class AlTriggerSubscription
{
    protected active = true;
    protected filterCb:AlTriggeredEventCallback|null = null;

    constructor( public stream:AlTriggerStream,
                 public eventType:string,
                 public listenerId:string,
                 public triggerCallback?:AlTriggeredEventCallback ) {
    }

    then( cb:AlTriggeredEventCallback ):AlTriggerSubscription {
        this.triggerCallback = cb;
        return this;
    }

    filter( cb:AlTriggeredEventCallback ):AlTriggerSubscription {
        this.filterCb = cb;
        return this;
    }

    trigger( event:AlTriggeredEvent ) {
        if ( this.active && this.triggerCallback ) {
            if ( this.filterCb === null || this.filterCb( event ) ) {
                this.triggerCallback( event );
            }
        }
    }

    pause() {
        this.active = false;
    }

    resume() {
        this.active = true;
    }

    cancel() {
        this.stream.detach( this );
    }
}

export class AlTriggerStream
{
    items:{[triggerType:string]:{[subscriptionId:string]:AlTriggerSubscription}} = {};
    subscriptionCount:number        =   0;
    downstream:AlTriggerStream|null      =   null;
    flowing:boolean                 =   false;
    captured:AlTriggeredEvent[]     =   [];

    constructor( flow:boolean = true ) {
        this.flowing = flow;
    }

    public getBucket( eventTypeName:string ) {
        if ( ! this.items.hasOwnProperty( eventTypeName ) ) {
            this.items[eventTypeName] = {};
        }
        return this.items[eventTypeName];
    }

    public attach( eventType:string, callback?:AlTriggeredEventCallback, subscriptionGroup?:AlSubscriptionGroup ):AlTriggerSubscription {
        const listenerId:string = `sub_${++this.subscriptionCount}`;
        const bucket = this.getBucket( eventType );
        const subscription = new AlTriggerSubscription( this, eventType, listenerId, callback );
        bucket[listenerId] = subscription;
        if ( subscriptionGroup ) {
            subscriptionGroup.manage( subscription );
        }
        return subscription;
    }

    public detach( subscription:AlTriggerSubscription ) {
        if ( this.items.hasOwnProperty( subscription.eventType ) && this.items[subscription.eventType].hasOwnProperty( subscription.listenerId ) ) {
            delete this.items[subscription.eventType][subscription.listenerId];
        }
    }

    public siphon( child:AlTriggerStream ) {
        child.downstream = this;
        child.tap();
    }

    public trigger( event:AlTriggeredEvent ):AlTriggeredEvent {
        let eventType = event.getEventType();
        if ( ! this.flowing ) {
            this.captured.push( event );
            return event;
        }
        const bucket = this.getBucket( eventType );
        let listenerIdList = Object.keys( bucket );
        listenerIdList.forEach( listenerId => {
            try {
                const subscription = bucket[listenerId];
                subscription.trigger( event );
            } catch( e ) {
                console.warn(`Trigger callback for event ${event.constructor.name} throw exception: ${e.message}; ignoring.` );
            }
        } );

        return this.downstream ? this.downstream.trigger( event ) : event;
    }

    public tap() {
        this.flowing = true;
        while( this.captured.length > 0 ) {
            const event = this.captured.shift();
            if(event) {
                this.trigger( event );
            }
        }
    }
}

/**
 * This is a simple utility to manage a list of subscriptions, which may be AlTriggerSubscriptions or RxJS subscriptions.
 * It exposes a method `manage` to add new subscriptions, and a method `cancelAll` to unsubscribe from all subscriptions.
 * That is all it does.
 */
export class AlSubscriptionGroup
{
    subscriptions:any[] = [];

    constructor( ...items:any[] ) {
        this.manage( ...items );
    }

    /**
     * Adds one or more subscriptions (as themselves, in arrays, via callback function, or some mixture of these inputs)
     * to the internal list of managed items.
     */
    public manage( ...items:any[] ) {
        items.forEach( item => {
            if ( typeof( item ) === 'object' && item !== null && item.hasOwnProperty( "length" ) ) {
                item.map( (subitem: any) => this.manage( subitem ) );
            } else if ( typeof( item ) === 'function' ) {
                this.manage( item() );
            } else if ( item ) {
                this.subscriptions.push( item );
            }
        } );
    }

    /**
     * Cancels/unsubscribes from all subscriptions.
     */
    public cancelAll() {
        this.subscriptions.map( subscription => {
            if ( typeof( subscription.cancel ) === 'function' ) {
                subscription.cancel();
            } else if ( typeof( subscription.unsubscribe ) === 'function' ) {
                subscription.unsubscribe();
            }
        } );
        this.subscriptions = [];
    }
}
