/**
 * The rebuilt kid face (owner directive #23: a ground-up kid frontend on the
 * unchanged engine) is selected by URL on the same origin as the stock shell,
 * mirroring the quickAddWindow pattern. Same origin means the new face shares
 * localStorage, the persisted store, and the sync token with the running app,
 * so both faces render the same live data side by side:
 *
 *   http://localhost:5173/            -> stock kid shell (unchanged)
 *   http://localhost:5173/?face=next  -> the new face
 */
export const KID_FACE_PARAM = 'face';
export const KID_FACE_NEXT = 'next';
export const KID_FACE_PLAYGROUND_ROOM = 'playground';

export function isNextFaceLocation(location: Pick<Location, 'search'> = window.location): boolean {
    return new URLSearchParams(location.search).get(KID_FACE_PARAM) === KID_FACE_NEXT;
}

export function isKidFacePlaygroundRoom(location: Pick<Location, 'search'> = window.location): boolean {
    return isNextFaceLocation(location)
        && new URLSearchParams(location.search).get('room') === KID_FACE_PLAYGROUND_ROOM;
}
