// This game shell was happily modified from Googler Seth Ladd's "Bad Aliens" game and his Google IO talk in 2011

class GameEngine {
    constructor(options) {
        // What you will use to draw
        // Documentation: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D

        // Information on the input
        this.click = null;
        this.mouse = null;
        this.wheel = null;
        this.keys = {};

        // Options and the Details
        this.options = options || {
            debugging: false,
        };
    };

    init() {
        this.startInput();
        this.timer = new Timer();
    };

    startInput() {
        document.getElementById("restart_sim").addEventListener("click", () => this.population.resetSim());
    };

    start() {
        this.running = true;
        const gameLoop = () => {
            this.loop();
            requestAnimFrame(gameLoop, document.body.children[0]);
        };
        gameLoop();
    };

    draw() {
        this.population.worlds.forEach(members => {
            if (params.WORLD_UPDATE_ASYNC) {
                execAsync(members.draw());
            }
            else {
                members.draw();
            }
        });
    };

    update() {
        if (!params.WORLD_UPDATE_ASYNC) {
            this.population.worlds.forEach((members) => {
                members.food.forEach((food) => {
                    food.update();
                });
                members.poison.forEach(poison => {
                    poison.update();
                });
                members.agents.forEach(agent => {
                    agent.update()
                });
                members.walls.forEach(wall => {
                    wall.update(members.ctx)
                });
            });
        }
        else {
            //Update world async
            this.population.worlds.forEach((world) => {
                execAsync(world.update());
            });
        }

        let isNewGeneration = this.population.update();

        if (isNewGeneration) {
            this.population.redistributeFoodAndPoison();

            if (params.FOOD_PERIODIC_REPOP) {
                this.population.checkFoodLevels(false);
            }

            if (params.POISON_PERIODIC_REPOP) {
                this.population.checkFoodLevels(true);
            }
        }
    };

    loop() {
        this.clockTick = this.timer.tick();
        this.update();
        this.draw();
    };

};

// KV Le was here :)
// and Artem Potafiy
// and Gabe Bryan