export function getJsonPath<Type=any>( target:any, path:string|string[], defaultValue?:Type ):Type|undefined {
    if ( typeof( target ) === 'object' && target !== null ) {
        if ( typeof( path ) === 'string' ) {
            path = path.split(".") || [];
        }
        let element = path.shift();
        if ( element && target.hasOwnProperty( element ) ) {
            if ( path.length === 0 ) {
                return target[element] as Type;
            } else {
                return getJsonPath<Type>( target[element], path, defaultValue );
            }
        }
    }
    return defaultValue;
}
