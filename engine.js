/*
params: Object{ - has all the paramaters
 canvas: HTMLCanvasElement - the canvas to which you want the game engine rendered. This is technicaly optional with default of querySelector(canvas), but plz don't do that.
 bgImg: HTMLImageElement|URL:string - Image for the background. This is technicaly optional with default of some random image, but plz don't do that.
 tilesConfig: Object{ - A configuration for the tile atlas. This is technicaly optional with default of some random values, but plz don't do that.
    smoothing: boolean - image smothing enabled. Aslo affects background smoothing
    atlas: HTMLImageElement - texture atlas to use.
    w: Number - Width in pixels of each texture on the atlas
    h: Number - Height in pixels of each texture on the atlas
    items: Object{ - include as many entries here as needed, each key name being the name of a tile. This links names to textures.
      your_tile_name: {
        x: Number - X position in the texture atlas. Based on tilesConfig.w, so it is the index of the tile's top left corner
        y: Number - Y position in the texture atlas. Based on tilesConfig.h, so it is the index of the tile's top left corner
      },
      different_tile_name: {
        x: Number - X position in the texture atlas. Based on tilesConfig.w, so it is the index of the tile's top left corner
        y: Number - Y position in the texture atlas. Based on tilesConfig.h, so it is the index of the tile's top left corner
      },
    }
}

?bounds: Object{
    xmax: Number - in world cords of distance for bounds
    ymax: Number - in world cords of distance for bounds
    xmin: Number - in world cords of distance for bounds
    ymin: Number - in world cords of distance for bounds
    zoomMax: Number - Multiplier of how far the user can zoom in
    zoomMin: Number - Multiplier of how far the user can zoom out
}
?tiles: Array - Default starting tiles - deafault: []
?tileSize: Number - Size in pixels of each tile on default 1x zoom - default: 128
?movementEnabled: Boolean - Whether or not the user can move arround - deafult: true
?zoomEnabled: Bollean - Whether of not the user can zoom - Defaults to the value of movementEnabled.
}

#Events:

events are dispatched to GTEtileEngine.eventEmitter
with events of "tilePlace" and "tileDelete", and event of {detail: {x, y, name}}
and event "placeError"
It is best to use these with a handler, rather than doing post-place/delete events in the click handling section, in case the tile placement/delete fails.
*/

class GTEtileEngine {
    constructor(params={}) {
        this.canvas = params.canvas||document.querySelector('canvas');
        if(params.bgImg && typeof params.bgImg === "object"){
            this.bgImg = params.bgImg;
        }

        if(params.bgImg && typeof params.bgImg === "string"){
            let temp = new Image();
            temp.src = params.bgImg;
            this.bgImg = temp;
        }
        if(!params.bgImg){
            console.warn("[GTE] bgImg not selected, using default.");
            let temp = new Image();
            temp.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/2013-morbihan-ile-berder-rankosol-granite0109.jpg/500px-2013-morbihan-ile-berder-rankosol-granite0109.jpg";
            this.bgImg = temp;
        }

        if(params.tilesConfig){
            this.tilesConfig = params.tilesConfig;
        } else {
          let tempAtlas = new Image();
          tempAtlas.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/A_curious_Welsh_Mountain_sheep_%28Ovis_aries%29.jpg/500px-A_curious_Welsh_Mountain_sheep_%28Ovis_aries%29.jpg"
          this.tilesConfig = {
            smoothing: true,
            atlas: tempAtlas,
            w: 500,
            h: 500,
            items: {
                tile: {x: 0, y:0}
            },
          };
        }
        params.loadCallback = params.loadCallback || (()=>{});
        this.enableMovement = params.enableMovement ?? true;
        this.enableZoom = params.enableZoom ?? this.enableMovement;
        this.bounds = params.bounds || { xmax: 16, ymax: 16, xmin: -16, ymin: -16, zoomMax: 1.5, zoomMin: 0.125};
        this.tiles = params.tiles || [];
        this.tileSize = params.tileSize || 128;
        this.eventEmitter = new EventTarget();
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};
        this.bgImg.decode().then(() => {
         this.tilesConfig.atlas.decode().then(() => {
          params.loadCallback();
          this.OSC = document.createElement('canvas');
          this.Octx = this.OSC.getContext('2d');
          this.OSC.width = this.bgImg.naturalWidth;
          this.OSC.height = this.bgImg.naturalHeight;
          this.Octx.drawImage(this.bgImg, 0, 0);
          this.pat = this.ctx.createPattern(this.OSC, "repeat");
          this.matrix = new DOMMatrix();
          this.camera = {
              x: 0,
              y: 0,
              zoom: 1,
          };
          this.mouse = {
              x: 0,
              y: 0,
              worldX: 0,
              worldY: 0,
          }
          this.xv = 0;
          this.yv = 0;
          this.zv = 0;
          this.resize();
          this.initEvents();
          this.loop();
         });
        });
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), {
            passive: false
        });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    #old = 0;
    loop(timestamp) {
        requestAnimationFrame(this.loop.bind(this));
        this.keyFunction(timestamp - this.#old);
        this.render();
        this.#old = timestamp;
    }

    render() {
        this.resize();
        let ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.imageSmoothingEnabled = this.tilesConfig.smoothing ?? false;
        this.matrix.setMatrixValue("matrix(1, 0, 0, 1, 0, 0)");
        this.matrix.translateSelf(this.camera.x, this.camera.y); // X offset, Y offset
        this.pat.setTransform(this.matrix);
        ctx.save();
        const scaleFactor = this.camera.zoom;
        ctx.scale(scaleFactor, scaleFactor);

        ctx.fillStyle = this.pat;
        ctx.fillRect(0, 0, this.canvas.width / scaleFactor, this.canvas.height / scaleFactor);

        ctx.restore();

        this.tiles.forEach((element, index) => {
            const config = this.tilesConfig;
            this.ctx.imageSmoothingEnabled = config.smoothing ?? false;
            let screenX = this.worldToCanvasCordsX(element.x);
            let screenY = this.worldToCanvasCordsY(element.y);
            const offset = 0.3;
            let scaledTileSize = this.tileSize * this.camera.zoom + offset;
            if(!config.items[element.name]) {
                console.error(`error: the block requested, ${element.name}, does not have a match in the config.`)
            }
            ctx.globalAlpha = element.opacity||1;
            ctx.drawImage(
                config.atlas,
                config.items[element.name].x * config.w + offset, config.items[element.name].y * config.h + offset, config.w - offset * 2, config.h - offset * 2,
                screenX, screenY, scaledTileSize, scaledTileSize
            );
            if(element.overlay){
                ctx.fillStyle = element.overlay;
                ctx.fillRect(
                    screenX, screenY, scaledTileSize, scaledTileSize
                );
            }
        });
        if(this.postRender){
           this.postRender();
        }
    }

    handleMouseDown(e) {
        this.handleMouseMove(e);
    }

    canvasToWorldCordsX(input) {
        return Math.floor((input - this.camera.x * this.camera.zoom) / (this.tileSize * this.camera.zoom));
    }

    canvasToWorldCordsY(input) {
        return Math.floor((input - this.camera.y * this.camera.zoom) / (this.tileSize * this.camera.zoom));
    }

    worldToCanvasCordsX(input) {
        return (input * this.tileSize + this.camera.x) * this.camera.zoom;
    }

    worldToCanvasCordsY(input) {
        return (input * this.tileSize + this.camera.y) * this.camera.zoom;
    }

    keyFunction(dt) {
        dt = dt || 0;
        this.camera.zoom = Math.min(Math.max(this.bounds.zoomMin, this.camera.zoom), this.bounds.zoomMax);
        let zoomSpeed = this.camera.zoom ** 0.5 / 50 * (dt / (1000/60));
        this.zv /= 1.25;
        this.camera.zoom *= this.zv + 1;
      if(this.enableMovement){
        let moveSpeed = 15 / this.camera.zoom * (dt / (1000/60));
        this.camera.y = Math.min(Math.max(this.bounds.ymin * this.tileSize - this.canvas.getBoundingClientRect().top + this.canvas.height * (1 / this.camera.zoom), this.camera.y), this.bounds.ymax * this.tileSize);
        this.camera.x = Math.min(Math.max(this.bounds.xmin * this.tileSize - this.canvas.getBoundingClientRect().left + this.canvas.width * (1 / this.camera.zoom), this.camera.x), this.bounds.xmax * this.tileSize);

        this.xv /= 1.45;
        this.yv /= 1.45;
        this.camera.x += this.xv;
        this.camera.y += this.yv;

        if(this.keys.ArrowLeft || this.keys.a) {
            this.xv += moveSpeed;
        }
        if(this.keys.ArrowRight || this.keys.d) {
            this.xv -= moveSpeed;
        }
        if(this.keys.ArrowUp || this.keys.w) {
            this.yv += moveSpeed;
        }
        if(this.keys.ArrowDown || this.keys.s) {
            this.yv -= moveSpeed;
        }
      }
      if(this.enableZoom){
        if(this.keys.PageUp) {
            this.zv += zoomSpeed;
        }
        if(this.keys.PageDown) {
            this.zv -= zoomSpeed;
        }
      }
    }

    handleMouseMove(e) {
        this.mouse.x = e.clientX - this.canvas.getBoundingClientRect().left;
        this.mouse.y = e.clientY - this.canvas.getBoundingClientRect().top;
        this.mouse.worldX = this.canvasToWorldCordsX(this.mouse.x)
        this.mouse.worldY = this.canvasToWorldCordsY(this.mouse.y)
    }

    handleMouseUp() {

    }

    handleWheel(e) {
        e.preventDefault();
        this.zv += (e.deltaY * this.camera.zoom ** 0.001 / -2000) * this.enableZoom;
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
        if(e.key.startsWith("ArrowUp") || e.key.startsWith("ArrowDown") || e.key.startsWith("Page")) {
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    spaceOccupied(x, y) { // Tells if a tile space from world cords is occupied, and returns the tile if so, or false if the tile is not occupied.
        let returnValue = false;
        this.tiles.forEach((e) => {
            if(e.x === x && e.y === y) {
                returnValue = e;
            }
        });
        return returnValue;
    }

    createTile(x, y, name, overlay, opacity, data) {
        if(!this.spaceOccupied(x, y)) {
            if(x >= this.bounds.xmin && x < this.bounds.xmax && y >= this.bounds.ymin && y < this.bounds.ymax) {
                this.tiles.push({
                    x: x,
                    y: y,
                    name: name,
                    overlay: overlay,
                    opacity: opacity,
                    data: data,
                });
                const event = new CustomEvent("tilePlace", {
                    detail: {
                        x: x,
                        y: y,
                        name: name,
                        overlay: overlay,
                        opacity: opacity,
                        data: data,
                    },
                });
                this.eventEmitter.dispatchEvent(event);
            } else {
                const event = new CustomEvent("placeError", {
                    detail: {id: "bounds", name: "Placement out of bounds."}
                });
                this.eventEmitter.dispatchEvent(event);
            }
        } else {
            const event = new CustomEvent("placeError", {
                detail: {id: "occupied", name: "Tile already occupied."}
            });
            this.eventEmitter.dispatchEvent(event);
        }
    }

    createTileAtMouse(name, overlay, opacity, data) {
        this.createTile(this.canvasToWorldCordsX(this.mouse.x), this.canvasToWorldCordsY(this.mouse.y), name, overlay, opacity, data);
    }

    deleteTile(x, y) {
        let filtered = this.tiles.filter((e) => !(e.x === x) || !(e.y === y));
        if(this.tiles.length !== filtered.length) {

            const event = new CustomEvent("tileDelete", {
                detail: this.tiles.filter((e) => !(!(e.x === x) || !(e.y === y)))[0],
            });

            this.eventEmitter.dispatchEvent(event);
            this.tiles = filtered;
        }
    }

    deleteTileAtMouse() {
        this.deleteTile(this.canvasToWorldCordsX(this.mouse.x), this.canvasToWorldCordsY(this.mouse.y));
    }

    getMouseWorldCoords() {
        return {
            x: this.canvasToWorldCordsX(this.mouse.x),
            y: this.canvasToWorldCordsY(this.mouse.y),
        }
    }

    changeBackground(bgImg) {
        this.bgImg = bgImg;
        this.OSC.width = this.bgImg.naturalWidth;
        this.OSC.height = this.bgImg.naturalHeight;
        this.Octx.drawImage(this.bgImg, 0, 0);
        this.pat = this.ctx.createPattern(this.OSC, "repeat");
        this.matrix = new DOMMatrix();
    }
}

const GTETileEngine = GTEtileEngine; // Idk what the capitalization is supposed to be, so I'll just add this.
