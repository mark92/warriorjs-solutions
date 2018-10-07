class Player {
    constructor() {
        this.state = "idle";
        this.acted = false;
        this.lastHealth = 20;
        this.underAttack = false;
        this.direction = "forward";
        this.reverseDirection = "backward";

        this.foundStairs = false;
        this.foundWall = false;
        this.thereIsStuffOnTheLeft = null;

        this.directionMap = [
            "forward",
            "right",
            "backward",
            "left"
        ];

        this.oppositeDirectionMap = {
            "forward": "backward",
            "backward": "forward",
            "left": "right",
            "right": "left"
        };
    }

    playTurn(w) {
        this.checkStatus(w);

        if (this.thereIsStuffOnTheLeft === null) {
            this.thereIsStuffOnTheLeft = this.checkStuffOnTheLeft(w);
        }

        while (this.acted == false) {
            this.analyzeSituation(w);
            w.think("I'm " + this.state);
            this.runStateMachine(w);
        }

        this.refresh(w);
    }

    refresh(w) {
        this.acted = false;
        this.lastHealth = w.health();
    }

    checkStatus(w) {
        this.checkUnderAttack(w);
    }

    checkUnderAttack(w) {
        if (w.health() < this.lastHealth) {
            this.underAttack = true;
        } else {
            this.underAttack = false;
        }
    }

    checkStuffOnTheLeft(w) {
        return this.lookAround(w).backward.match(/enemy|ally/i);
    }

    analyzeSituation(w) {
        const surroundings = this.lookAround(w);
        const enemiesAround = (this.directionMap.some( direction => {return surroundings[direction].match("Enemy")}));
        const rangedEnemiesAround = (surroundings.forward.match("rangedEnemy") || surroundings.backward.match("rangedEnemy"));

        switch (this.state) {
            case "idle":
                if (!this.healthy(w) && enemiesAround) {
                    this.setState("healing");
                } else {
                    this.setState("brave");
                }
                if (this.injured(w) && !enemiesAround) {
                    this.setState("healing");
                }
                if (this.healthy(w) || rangedEnemiesAround) {
                    this.setState("brave");
                }
                break;
            case "healing":
                if (this.healthy(w)) {
                    this.setState("brave");
                }
                if (this.underAttack) {
                    this.setState("furious");
                }
                break;
            case "brave":
                if (this.battered(w) && !this.underAttack) {
                    this.setState("idle");
                }
                // if (this.battered(w) && this.underAttack) {
                //     this.setState("furious");
                // }
                if (this.injured(w)) {
                    this.setState("retreating");
                }
                break;
            case "furious":
                if (!this.enemyInFront(w)) {
                    this.setState("idle");
                }
                break;
            case "retreating":
                if (!this.enemyInFront(w)) {
                    this.setState("idle");
                }
                break;
        }
    }

    runStateMachine(w) {
        switch (this.state) {
            case "idle":
                break;
            case "healing":
                this.heal(w);
                break;
            case "brave":
                this.explore(w);
                break;
            case "furious":
                this.explore(w);
                break;
            case "retreating":
                this.retreat(w);
                break;
        }
    }

    setState(newState) {
        this.state = newState;
    }

    heal(w) {
        w.rest();
        this.acted = true;
    }

    explore(w) {
        const surroundings = this.lookAround(w);

        const directionOfEnemy = this.findDirectionOfEnemy(w, surroundings);
        const directionOfAlly = this.findDirectionOfAlly(w, surroundings);

        const mainDirection = directionOfEnemy || directionOfAlly || "forward";
        this.spin(w, mainDirection);
        w.think("I have " + surroundings[mainDirection]);

        switch (surroundings[mainDirection]) {
            case "enemyInFront":
                w.attack(this.direction);
                break;
            case "allyInFront":
                if (this.isAllyCaptive(w)) {
                    w.rescue(this.direction);
                }
                break;
            case "allyAhead":
                w.walk(this.direction);
                break;
            case "rangedEnemyAhead":
                w.shoot(this.direction);
                break;
            case "meleeEnemyAhead":
                w.shoot(this.direction);
                break;
                // case "wallInFront":
                //     this.foundWall = true;
                //     w.pivot();
                //     break;
            // case "stairsInFront":
            //     if (!this.foundStairs && !this.foundWall && this.thereIsStuffOnTheLeft) {
            //         this.foundStairs = true;
            //         w.pivot();
            //     } else {
            //         w.walk(this.direction);
            //     }
            //     break;
            case "stairsInFront":
            case "nothingInFront":
                const direction = w.directionOfStairs();
                w.walk(direction);
                break;
        }

        this.acted = true;
    }

    findDirectionOfEnemy(w, surroundings) {
        for (var direction in surroundings) {
            if (surroundings[direction].match(/enemy/i)) {
                return direction;
            }
        }

        return false;
    }

    findDirectionOfAlly(w, surroundings) {
        for (var direction in surroundings) {
            if (surroundings[direction].match(/ally/i)) {
                return direction;
            }
        }

        return false;
    }

    lookAround(w) {
        const surroundings = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        this.directionMap.forEach(direction => {
            this.spin(w, direction);
            this.lookInOneDirection(w, surroundings, direction);
        });

        this.spin(w, "forward");

        return surroundings;
    }

    lookInOneDirection(w, surroundings, direction) {
        if (w.feel(direction).isEmpty()) {
            surroundings[direction] = "nothingInFront";
        }

        if (w.feel(direction).isStairs()) {
            surroundings[direction] = "stairsInFront";
        }

        // if (this.enemyAhead(w)) {
        //     if (this.enemyIsArcherOrWizard(w)) {
        //         surroundings[direction] = "rangedEnemyAhead";
        //     } else {
        //         surroundings[direction] = "meleeEnemyAhead";
        //     }
        // }

        if (this.enemyInFront(w)) {
            surroundings[direction] = "enemyInFront";
        }

        // if (this.allyAhead(w)) {
        //     surroundings[direction] = "allyAhead";
        // }

        if (this.allyInFront(w)) {
            surroundings[direction] = "allyInFront";
        }

        if (this.wallInFront(w)) {
            surroundings[direction] = "wallInFront";
        }
    }

    retreat(w) {
        w.walk(this.reverseDirection);
        this.acted = true;
    }

    injured(w) {
        return w.health() < 5;
    }

    battered(w) {
        return w.health() < 9;
    }

    healthy(w) {
        return w.health() >= 9;
    }

    enemyInFront(w) {
        return !w.feel(this.direction).isEmpty() && w.feel(this.direction).isUnit() && w.feel(this.direction).getUnit().isEnemy();
    }

    enemyAhead(w) {
        const spaceWithUnit = w.look(this.direction).find(space => space.isUnit());
        if (spaceWithUnit) {
            return spaceWithUnit.getUnit().isEnemy();
        }

        return false;
    }

    enemyIsArcherOrWizard(w) {
        const distance = w.look(this.direction).findIndex(space => space.isUnit()) + 1;
        return distance == 3;
    }

    allyAhead(w) {
        const spaceWithUnit = w.look(this.direction).find(space => space.isUnit());
        if (spaceWithUnit) {
            return !spaceWithUnit.getUnit().isEnemy();
        }

        return false;
    }

    allyInFront(w) {
        return !w.feel(this.direction).isEmpty() && w.feel(this.direction).isUnit() && !w.feel(this.direction).getUnit().isEnemy();
    }

    isAllyCaptive(w) {
        return w.feel(this.direction).getUnit().isBound();
    }

    wallInFront(w) {
        return w.feel(this.direction).isWall();
    }

    spin(w, forcedDirection) {
        this.direction = forcedDirection ? forcedDirection : this.oppositeDirectionMap[this.direction];
        this.reverseDirection = forcedDirection ? this.oppositeDirectionMap[forcedDirection] : this.oppositeDirectionMap[this.reverseDirection];
    }
}
