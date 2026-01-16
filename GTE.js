// Main file: GTE.js v1.0
/*
Class paramaters
canvas: HTMLCanvasElement - the canvas to which you want the game engine rendered
bgImg: HTMLImageElement - Image for the background
tilesConfig: Object{
    smoothing: boolean - image smothing enabled.
    atlas: HTMLImageElement - texture atlas to use.
    w: Number - Width in pixels of each texture on the atlas
    h: Number - Height in pixels of each texture on the atlas
    items: Object{ - include as many entries here as needed, each key name being the name of a tile. This links names to textures.
      your_tile_name: {
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
    zoomMax: Number - Multiplier of how far the user can zoom in - WARNING, this can only be about 1.5 before things break (might be patched later), so just update tileSize to have it make sense.
    zoomMin: Number - Multiplier of how far the user can zoom out
}
?tiles: Array - Default starting tiles
?tileSize: Number - Size in pixels of each tile on default 1x zoom
*/

class GTEtileEngine {
    constructor(canvas, bgImg, tilesConfig, bounds = !"This is set to itsdefault later", tiles = [], tileSize = 128) {
        this.keys = {};
        this.bounds = bounds||{ xmax: 16, ymax: 16, xmin: -16, ymin: -16, zoomMax: 1.5, zoomMin: 0.125};
        this.tilesConfig = tilesConfig;
        this.eventEmitter = new EventTarget();
        this.tiles = [{
                name: "inferno_block",
                x: 0,
                y: 0,
            },
            {
                x: 1,
                y: 1,
                name: "wood_chest"
            }
        ];
        this.tileSize = tileSize;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.bgImg = bgImg;
        this.OSC = document.createElement('canvas');
        this.Octx = this.OSC.getContext('2d');
        this.OSC.width = this.bgImg.naturalWidth;
        this.OSC.height = this.bgImg.naturalHeight;
        this.Octx.drawImage(this.bgImg, 0, 0);
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
        this.tiles.push({
            x: this.bounds.xmax - 1,
            y: this.bounds.ymax - 1,
            name: "water"
        })
        this.tiles.push({
            x: this.bounds.xmin,
            y: this.bounds.ymin,
            name: "inferno_block"
        })

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

    loop() {
        requestAnimationFrame(this.loop.bind(this));
        this.keyFunction();
        this.render();
    }


    render() {
        let ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.imageSmoothingEnabled = true;

        const pat = ctx.createPattern(this.OSC, "repeat");
        const matrix = new DOMMatrix();
        matrix.translateSelf(this.camera.x * 1, this.camera.y * 1); // X offset, Y offset
        pat.setTransform(matrix);
        ctx.save();
        const scaleFactor = this.camera.zoom;
        ctx.scale(scaleFactor, scaleFactor);

        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);

        ctx.restore();

        ctx.rect(0, 0, 10, 10);
        ctx.fillStyle = pat;
        ctx.fill();
        // Holy, after 5+ hours of work, the bg section is done and good enough.

        this.tiles.forEach((element, index) => {
            const config = this.tilesConfig;
            this.ctx.imageSmoothingEnabled = config.smoothing;
            let screenX = this.worldToCanvasCordsX(element.x) - 0;
            let screenY = this.worldToCanvasCordsY(element.y) - 0;
            const offset = 0.3;
            let scaledTileSize = this.tileSize * this.camera.zoom + offset;
            if(!config.items[element.name]) {
                alert(`error: the block requested, ${element.name}, does not have a match in the config.`)
                throw new Error(`error: the block requested, ${element.name}, does not have a match in the config.`)
            }
            ctx.drawImage(
                config.atlas,
                config.items[element.name].x * config.w + offset, config.items[element.name].y * config.h + offset, config.w - offset * 2, config.h - offset * 2,
                screenX, screenY, scaledTileSize, scaledTileSize
            );
        })

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

    keyFunction() {
        this.camera.zoom = Math.min(Math.max(this.bounds.zoomMin, this.camera.zoom), this.bounds.zoomMax);
        this.camera.x = Math.min(Math.max(this.bounds.xmin * this.tileSize - this.canvas.getBoundingClientRect().left + this.canvas.width * (1 / this.camera.zoom), this.camera.x), this.bounds.xmax * this.tileSize);
        this.camera.y = Math.min(Math.max(this.bounds.ymin * this.tileSize - this.canvas.getBoundingClientRect().top + this.canvas.height * (1 / this.camera.zoom), this.camera.y), this.bounds.ymax * this.tileSize);
        let moveSpeed = 15 / this.camera.zoom;
        let zoomSpeed = this.camera.zoom ** 0.5 / 50;

        this.xv /= 1.45 / (((this.camera.zoom - 1) / 4) + 1);
        this.yv /= 1.45 / (((this.camera.zoom - 1) / 4) + 1);
        this.zv /= 1.25;
        this.camera.x += this.xv;
        this.camera.y += this.yv;
        this.camera.zoom *= this.zv + 1;

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
        if(this.keys.PageUp) {
            this.zv += zoomSpeed;
        }
        if(this.keys.PageDown) {
            this.zv -= zoomSpeed;
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
        this.zv += e.deltaY * this.camera.zoom ** 0.001 / -2000;
    }

    handleKeyDown(e) {
        this.keys[e.key] = true;
        if(e.key.startsWith("Arrow") || e.key.startsWith("Page")) {
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

    createTile(x, y, name) {
        if(!this.spaceOccupied(x, y)) {
            if(x >= this.bounds.xmin && x < this.bounds.xmax && y >= this.bounds.ymin && y < this.bounds.ymax) {
                this.tiles.push({
                    x: x,
                    y: y,
                    name: name
                });
                const event = new CustomEvent("tilePlace", {
                    detail: {
                        x: x,
                        y: y,
                        name: name,
                    },
                });
                this.eventEmitter.dispatchEvent(event);
            } else {
                throw new Error("Placement out of bounds.");
            }
        } else {
            throw new Error("Placement space already occupied.")
        }
    }

    createTileAtMouse(name) {
        this.createTile(this.canvasToWorldCordsX(this.mouse.x), this.canvasToWorldCordsY(this.mouse.y), name);
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
    }
}
