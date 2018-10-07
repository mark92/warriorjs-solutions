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

        this.oppositeDirectionMap = {
            "forward": "backward",
            "backward": "forward"
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
        const enemiesAround = (surroundings.forward.match("Enemy") || surroundings.backward.match("Enemy"));
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
                if (this.injured(w)) {
                    this.setState("retreating");
                }
                if (this.battered(w) && !this.underAttack) {
                    this.setState("idle");
                }
                if (this.battered(w) && this.underAttack) {
                    this.setState("furious");
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
        w.think("I have " + surroundings.forward);

        switch (surroundings.backward) {
            case "rangedEnemyAhead":
                w.pivot();
                break;
            default:
                switch (surroundings.forward) {
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
                    case "wallInFront":
                        this.foundWall = true;
                        w.pivot();
                        break;
                    case "stairsInFront":
                        if (!this.foundStairs && !this.foundWall && this.thereIsStuffOnTheLeft) {
                            this.foundStairs = true;
                            w.pivot();
                        } else {
                            w.walk(this.direction);
                        }
                        break;
                    case "nothingInFront":
                        w.walk(this.direction);
                        break;
                };
        }

        this.acted = true;
    }

    lookAround(w) {
        const surroundings = {
            forward: false,
            backward: false
        };

        this.lookInOneDirection(w, surroundings);
        this.spin(w);
        this.lookInOneDirection(w, surroundings);
        this.spin(w);


        return surroundings;
    }

    lookInOneDirection(w, surroundings) {
        if (w.feel(this.direction).isEmpty()) {
            surroundings[this.direction] = "nothingInFront";
        }

        if (w.feel(this.direction).isStairs()) {
            surroundings[this.direction] = "stairsInFront";
        }

        if (this.enemyAhead(w)) {
            if (this.enemyIsArcherOrWizard(w)) {
                surroundings[this.direction] = "rangedEnemyAhead";
            } else {
                surroundings[this.direction] = "meleeEnemyAhead";
            }
        }

        if (this.enemyInFront(w)) {
            surroundings[this.direction] = "enemyInFront";
        }

        if (this.allyAhead(w)) {
            surroundings[this.direction] = "allyAhead";
        }

        if (this.allyInFront(w)) {
            surroundings[this.direction] = "allyInFront";
        }

        if (this.wallInFront(w)) {
            surroundings[this.direction] = "wallInFront";
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

    spin(w) {
        this.direction = this.oppositeDirectionMap[this.direction];
        this.reverseDirection = this.oppositeDirectionMap[this.reverseDirection];
    }
}
