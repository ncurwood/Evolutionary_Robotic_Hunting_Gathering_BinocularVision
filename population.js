class PopulationManager {

    static SPECIES_ID = 0;
    static GEN_NUM = 0;
    static SPECIES_CREATED = 0;
    static SPECIES_COLORS = new Map();
    static SPECIES_SENSOR_COLORS = new Map();
    static SPECIES_MEMBERS = new Map();
    static COLORS_USED = new Set();
    static SENSOR_COLORS_USED = new Set();
    static MIN_AGENTS = 50;

    constructor(game) {
        this.game = game;
        this.agents = [];
        this.food = [];
        this.foodTracker = new FoodTracker();
        this.agentTracker = new AgentTracker();
        this.tickCounter = 0;
        this.genomeTracker = new GenomeTracker();
        let defaultColor = randomInt(361);
        PopulationManager.COLORS_USED.add(defaultColor);
        PopulationManager.SPECIES_COLORS.set(0, defaultColor);
        let defaultSensorColor = randomBlueHue();
        PopulationManager.SENSOR_COLORS_USED.add(defaultSensorColor);
        PopulationManager.SPECIES_SENSOR_COLORS.set(0, defaultSensorColor);
        this.spawnAgents();
        this.spawnFood();
    };

    update() {
        params.FREE_RANGE = document.getElementById("free_range").checked;
        params.AGENT_NEIGHBORS = document.getElementById("agent_neighbors").checked;
        params.FOOD_OUTSIDE = document.getElementById("food_outside_circle").checked;
        params.ENFORCE_MIN_FOOD = document.getElementById("enforce_min_food").checked;
        params.RAND_FOOD_PHASES = document.getElementById("rand_food_phases").checked;
        params.RAND_FOOD_LIFETIME = document.getElementById("rand_food_lifetime").checked;
        params.FOOD_PERIODIC_REPOP = document.getElementById("periodic_food_repop").checked;

        if (document.activeElement.id !== "min_food") {
            params.MIN_FOOD = parseInt(document.getElementById("min_food").value);
        }
        if (document.activeElement.id !== "agent_vision_radius") {
            params.AGENT_VISION_RADIUS = parseFloat(document.getElementById("agent_vision_radius").value);
        }
        if (document.activeElement.id !== "compat_threshold") {
            params.COMPAT_THRESH = parseFloat(document.getElementById("compat_threshold").value);
        }
        
        this.cleanupFood();
        if (params.ENFORCE_MIN_FOOD && this.food.length < params.MIN_FOOD) {
            this.spawnFood(params.MIN_FOOD - this.food.length);
        }

        this.tickCounter++;
        if (this.tickCounter === params.GEN_TICKS) { // we've reached the end of the generation
            this.tickCounter = 0;
            this.processGeneration();
            if (document.activeElement.id !== "generation_time") {
                params.GEN_TICKS = parseInt(document.getElementById("generation_time").value);
            } 
            return true;
        }
        return false;
    };

    cleanupFood() {
        for (let i = this.food.length - 1; i >= 0; --i) { // remove eaten or dead food
            if (this.food[i].removeFromWorld) {
                this.food.splice(i, 1);
            }
        }
    };

    checkFoodLevels() {
        this.cleanupFood();
        this.spawnFood(params.MIN_FOOD - this.food.length);
    };

    spawnAgents() {
        PopulationManager.SPECIES_MEMBERS.set(PopulationManager.SPECIES_ID, []);
        PopulationManager.SPECIES_CREATED++;
        for (let i = 0; i < PopulationManager.MIN_AGENTS; i++) { // add agents
            let agent = new Agent(this.game, params.CANVAS_SIZE / 2, params.CANVAS_SIZE / 2);
            agent.speciesId = PopulationManager.SPECIES_ID;
            PopulationManager.SPECIES_MEMBERS.get(PopulationManager.SPECIES_ID).push(agent);
            this.game.addEntity(agent);
            this.agents.push(agent);
        }
    };

    spawnFood(count = params.MIN_FOOD) {
        let seedlings = [];
        for (let i = 0; i < count; i++) { // add food sources
            let randomDist = randomInt(params.CANVAS_SIZE / 2);
            let randomAngle = randomInt(360) * Math.PI / 180;
            let x = params.CANVAS_SIZE / 2 + randomDist * Math.cos(randomAngle);
            let y = params.CANVAS_SIZE / 2 + randomDist * Math.sin(randomAngle);
            let food = new Food(this.game, x, y, false, this.foodTracker);
            seedlings.push(food);
        }
        this.registerSeedlings(seedlings);
    };

    registerSeedlings(seedlings) {
        seedlings.forEach(seedling => {
            this.food.push(seedling);
            this.game.addEntity(seedling);
        });
    };

    registerChildAgents(children) {
        let repMap = new Map();
        PopulationManager.SPECIES_MEMBERS.forEach((speciesList, speciesId) => {
            // choose a rep for each species
            repMap.set(speciesId, speciesList[0]);
        });

        let compatOrder = [...repMap.keys()].sort(); // sort by speciesId such that compatibility is always considered in the same order
        children.forEach(child => { // fit child into a species
            let matchFound = false;
            compatOrder.forEach(speciesId => {
                let rep = repMap.get(speciesId);
                if (!matchFound && Genome.similarity(rep.genome, child.genome) <= params.COMPAT_THRESH) { // species matched
                    matchFound = true;
                    child.speciesId = speciesId;
                    PopulationManager.SPECIES_MEMBERS.get(speciesId).push(child);
                }
            });

            if (!matchFound) { // no compatible, create a new species
                PopulationManager.SPECIES_CREATED++;
                child.speciesId = ++PopulationManager.SPECIES_ID;
                PopulationManager.SPECIES_MEMBERS.set(child.speciesId, []);
                let newColor = randomInt(361);
                while (PopulationManager.COLORS_USED.has(newColor)) {
                    newColor = randomInt(361);
                }
                PopulationManager.COLORS_USED.add(newColor);
                PopulationManager.SPECIES_COLORS.set(child.speciesId, newColor);
                let newSensorColor = randomBlueHue();
                while (PopulationManager.SENSOR_COLORS_USED.has(newSensorColor)) {
                    newSensorColor = randomBlueHue();
                }
                PopulationManager.SENSOR_COLORS_USED.add(newSensorColor);
                PopulationManager.SPECIES_SENSOR_COLORS.set(child.speciesId, newSensorColor);
                PopulationManager.SPECIES_MEMBERS.get(child.speciesId).push(child);
                repMap.set(child.speciesId, child); // child becomes representative for next children
                compatOrder = [...repMap.keys()].sort(); // resort the compatibility ordering
            }

            this.game.addEntity(child);
            this.agents.push(child);
        });
    };

    countDeads() {
        let count = 0;
        this.agents.forEach(agent => {
            if (agent.removeFromWorld) {
                count++;
            }
        });
        return count;
    };

    countAlives() {
        let count = 0;
        this.agents.forEach(agent => {
            if (!(agent.removeFromWorld)) {
                count++;
            }
        });
        return count;
    };

    processGeneration() {
        this.agents.forEach(agent => {
            this.agentTracker.processAgent(agent);
            this.genomeTracker.processGenome(agent.genome);
            agent.age++;
            agent.assignFitness();
        });

        Genome.resetInnovations(); // reset the innovation number mapping for newly created connections

        let reprodFitMap = new Map();
        let minShared = 0;
        PopulationManager.SPECIES_MEMBERS.forEach((speciesList, speciesId) => {
            let sumRaws = 0;
            speciesList.forEach(member => {
                sumRaws += member.genome.rawFitness;
            });
            minShared = Math.min(minShared, sumRaws);
            reprodFitMap.set(speciesId, sumRaws / speciesList.length);
        });
        let sumShared = 0;
        reprodFitMap.forEach((fitness, speciesId) => {
            const newFit = fitness + minShared * -1 + 10;
            reprodFitMap.set(speciesId, newFit);
            sumShared += reprodFitMap.get(speciesId);
            this.agentTracker.addSpeciesFitness({speciesId, fitness: newFit});
        });

        if (!params.FREE_RANGE) {
            let rouletteOrder = [...reprodFitMap.keys()].sort();
            let ascendingFitSpecies = [...reprodFitMap.keys()].sort((s1, s2) => reprodFitMap.get(s1) - reprodFitMap.get(s2));
            let deathFitMap = new Map();
            for (let i = 0; i < ascendingFitSpecies.length; i++) {
                deathFitMap.set(ascendingFitSpecies[i], reprodFitMap.get(ascendingFitSpecies[ascendingFitSpecies.length - i - 1]));
            }
    
            let deadCount = this.countDeads(); // this call is if we are transitioning from free range -> generational mode
            for (let i = 0; i < Math.ceil(this.agents.length / 2) - deadCount; i++) { // death roulette -> kill the ceiling to ensure agent list is always even
                let killed = false;
                while (!killed) { // keep rolling the roulette wheel until someone dies
                    let rouletteResult = randomFloat(sumShared);
                    let rouletteIndex = 0;
                    let accumulator = 0;
                    let flag = false;
                    while (!flag) {
                        let nextSpecies = rouletteOrder[rouletteIndex];
                        accumulator += deathFitMap.get(nextSpecies);
                        if (accumulator >= rouletteResult) { // we try to kill a parent... might not be successful
                            flag = true;
                            let killOptions = shuffleArray(PopulationManager.SPECIES_MEMBERS.get(nextSpecies));
                            let j = 0;
                            while (j < killOptions.length && !killed) {
                                let toKill = killOptions[j];
                                if (!toKill.removeFromWorld) {
                                    killed = true;
                                    toKill.removeFromWorld = true;
                                }
                                j++;
                            }
                        }
                        rouletteIndex++;
                    }
                } 
            }

            let children = [];
            let alives = this.countAlives(); // if free range mode kills off everybody, we produce at least 1 new agent
            for (let i = 0; i < PopulationManager.MIN_AGENTS - alives; i++) { // randomly produce offspring between n pairs of remaining agents, reproduction roulette
                let rouletteResult = randomFloat(sumShared);
                let rouletteIndex = 0;
                let accumulator = 0;
                let flag = false;
                let parent1, parent2;
                while (!flag) {
                    let nextSpecies = rouletteOrder[rouletteIndex];
                    accumulator += reprodFitMap.get(nextSpecies);
                    if (accumulator >= rouletteResult) {
                        flag = true;
                        let possibleParents = PopulationManager.SPECIES_MEMBERS.get(nextSpecies);
                        parent1 = possibleParents[randomInt(possibleParents.length)];
                        parent2 = possibleParents[randomInt(possibleParents.length)];
                    }
                    rouletteIndex++;
                }
                let childGenome = Genome.crossover(parent1.genome, parent2.genome);
                childGenome.mutate();
                let child = new Agent(this.game, params.CANVAS_SIZE / 2, params.CANVAS_SIZE / 2, childGenome);
                children.push(child);
            }
            this.registerChildAgents(children);
        }

        for (let i = this.agents.length - 1; i >= 0; --i) { // unregister killed parents
            if (this.agents[i].removeFromWorld) {
                this.agents.splice(i, 1);
            }
        }

        let remainingColors = new Set(); // we need to filter out the colors of species that have died out for reuse
        let remainingSensorColors = new Set(); // same thing with sensor colors
        PopulationManager.SPECIES_MEMBERS = new Map();
        this.agents.forEach(agent => { // fill species members map with surviving parents and children
            if (PopulationManager.SPECIES_MEMBERS.get(agent.speciesId) === undefined) {
                PopulationManager.SPECIES_MEMBERS.set(agent.speciesId, []);
            }
            PopulationManager.SPECIES_MEMBERS.get(agent.speciesId).push(agent);
            remainingColors.add(PopulationManager.SPECIES_COLORS.get(agent.speciesId));
            remainingSensorColors.add(PopulationManager.SPECIES_SENSOR_COLORS.get(agent.speciesId));
        });
        PopulationManager.COLORS_USED = new Set([...PopulationManager.COLORS_USED].filter(color => remainingColors.has(color)));
        PopulationManager.SENSOR_COLORS_USED = new Set([...PopulationManager.SENSOR_COLORS_USED].filter(color => remainingSensorColors.has(color)));

        if (!params.FREE_RANGE) {
            this.agents.forEach(agent => {
                agent.resetPos();
                agent.resetOrigin();
                agent.resetEnergy();
            });
        }

        PopulationManager.GEN_NUM++;
        generateAgeChart(this.agentTracker.getAgeData());
        generateFoodConsumptionChart(this.foodTracker.getConsumptionData());
        generateFoodStageChart(this.foodTracker.getLifeStageData());
        generateConnectionChart(this.genomeTracker.getConnectionData());
        generateCycleChart(this.genomeTracker.getCycleData());
        generateNodeChart(this.genomeTracker.getNodeData());
        generateCurrentFitnessChart(this.agentTracker.getFitnessData());
        this.foodTracker.addNewGeneration();
        this.agentTracker.addNewGeneration();
        this.genomeTracker.addNewGeneration();
    };
};