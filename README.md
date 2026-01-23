# GTE (GTE Tile Engine)
>Recursive initialisms are funni

Your <!--least-->favorite not-at-all mobile-friendly tile game engine!<br>
A semi-simple game engine for games using a tile-based world. Active work in progress.<br>
It is useful for starting game devs who want something simple and beginer-friendly to start with, but also powerful for more advanced features.<br>
Perfect for making tile games such as:
* Top-down or sideview games!
* Pixel games!
* tile survival games!
* city builders!
* Idk, anything with tiles and a player!

All the documentation is in the `engine.js` file, but here is some more!<br>
## Quickstart
### How to embed?
Put this <i>before</i> your code.
```HTML
<script src="https://cdn.jsdelivr.net/gh/cool-user1481/GTE-Tile-Engine@latest/engine.min.js"></script>
```
### How to use?
Take this as an example as a basis for your usage.
```Javascript
// Code sample was written for v1.2.0, but higher patch and minor release numbers may still have compatability
let atlas = new Image();
atlas.src = !"The image of your texture atlas here!" || "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/PlaceholderLC.png/64px-PlaceholderLC.png"; 
let bgImg = new Image();
bgImg.src = !"The image of you background here!" || "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/PlaceholderLC.png/64px-PlaceholderLC.png";
const tileConfig = {
    smoothing: false, // Set to false for pixel art
    atlas: atlas,
    w: 32, // Set this to the number of pixels wide each tile is in the atlas
    h: 32, // Same as w, but for height
    items: {
      tile: {x:0,y:0}, // This tile would be the one all the way in the top-left corner. The x and y reference the texture's position, not the number of image pixels
    },
}

let game; // Define game outside callbacks to make it usable.
 atlas.decode()
  .then(() => {
    bgImg.decode() // Waits until the atlas and background have loaded to start the game engine
  .then(() => {
    game = new GTEtileEngine({
        cavnas: document.getElementById('canvas'),
        bgImg: bgImg,
        tileConfig: tileConfig
    }); // Create instance with the canvas, background image, and tile config
    game.canvas.addEventListener("mousedown", clickHandler) // Add a click handler on the canvas to do whatever
    game.eventEmitter.addEventListener("tilePlace", (e) => placeHandler(e)) // This gets used after a tile is successfuly placed.
    game.eventEmitter.addEventListener("tileDelete", (e) => deleteHandler(e)) // Same as tilePlace, but deleted.
  });
 });


function clickHandler(e){
    if (e.button === 0) { // Left click
        game.createTileAtMouse("tile"); // Place tile of id tile (defined in tilesConfig) on left click
    }
    if (e.button === 1) { // Middle click
        e.preventDefault(); // Prevent scrolling
    }
    if (e.button === 2) { // Right click
        game.deleteTileAtMouse(); // Remove tiles on right click
    }
}

function placeHandler(e){
    console.log(e.detail.name + "was placed!") // also gives e.detail.x and y
    
}

function deleteHandler(e){
    console.log(e.detail.name + "was deleted!") // also gives e.detail.x and y
}
```
