ctx = document.getElementById("canvas").getContext('2d');

let drawCircle = (x, y, r) => {
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
};

FRAMERATE = 60.0;
W = 50;
H = 50;

class Partition {
    constructor(x, y, w, h, type) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = "";
        this.connections = [];
        this.distance = 1000;
    }

    split = () => {
        let rand_mid = () => {
            let center = 0.5;
            let width = 0.6;
            return (Math.random() - 0.5) * width + center;
        }

        let MIN_SIZE = 3;

        if (this.w > this.h) {
            let w1 = Math.floor(rand_mid() * this.w);
            let w2 = this.w - w1 - 1;
            if (w1 < MIN_SIZE || w2 < MIN_SIZE) return [this];
            return [new Partition(this.x, this.y, w1, this.h), new Partition(this.x + w1 + 1, this.y, w2, this.h)];
        } else {
            let h1 = Math.floor(rand_mid() * this.h);
            let h2 = this.h - h1 - 1;
            if (h1 < MIN_SIZE || h2 < MIN_SIZE) return [this];
            return [new Partition(this.x, this.y, this.w, h1), new Partition(this.x, this.y + h1 + 1, this.w, h2)];
        }
    }

    point_in = (x, y) => {
        return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h;
    }

    point_next_to = (x, y) => {
        return (x >= this.x - 1 && x < this.x + this.w + 1 && y >= this.y && y < this.y + this.h) ||
            (x >= this.x && x < this.x + this.w && y >= this.y - 1 && y < this.y + this.h + 1);
    }

    area = () => {
        return this.w * this.h;
    }

    get_branch_point = () => {
        let points = [];
        for (let x = this.x; x < this.x + this.w; x++) {
            points.push({ x: x, y: this.y - 1 });
            points.push({ x: x, y: this.y + this.h });
        }
        for (let y = this.y; y < this.y + this.h; y++) {
            points.push({ x: this.x - 1, y: y });
            points.push({ x: this.x + this.w, y: y });
        }
        points = points.filter(p => this.connections.filter(c => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1).length === 0);
        points.sort(() => 0.5 - Math.random());
        return points[0];
    }

    draw = () => {
        ctx.fillStyle = "black";
        switch (this.type) {
            case 'spawn':
                ctx.fillStyle = 'blue';
                break;
            case 'boss':
                ctx.fillStyle = 'red';
                break;
        }
        ctx.fillRect(this.x, this.y, this.w, this.h);
        for (const c of this.connections) {
            ctx.fillStyle = 'black';
            ctx.fillRect(c.x, c.y, 1, 1);
        }
    }
}

let generate_dungeon_candidate = () => {
    let partitions = [new Partition(0, 0, W, H)];
    let grid = [];

    let split_partitions = (prob) => {
        for (partition of partitions) {
            if (Math.random() < prob) {
                partitions = partitions.filter(p => p !== partition); // remove partition
                partitions = partitions.concat(partition.split()); // add splits
            }
        }
    };

    let remove_wall_rooms = () => {
        for (const partition of partitions) {
            if (partition.x === 0 || partition.y === 0 || partition.x + partition.w === W || partition.y + partition.h === H) {
                partitions = partitions.filter(p => p != partition);
            }
        }
    }

    let populate_grid = () => {
        for (let x = 0; x < W; x++) {
            grid[x] = [];
            for (let y = 0; y < H; y++) {
                grid[x][y] = false;
                for (const partition of partitions) {
                    if (partition.point_in(x, y)) grid[x][y] = partition;
                }
            }
        }
    }

    for (let i = 0; i < 2; i++) split_partitions(0.75);
    for (let i = 0; i < 2; i++) split_partitions(1);
    for (let i = 0; i < 4; i++) split_partitions(0.5);
    remove_wall_rooms();
    populate_grid();

    partitions.sort((a, b) => a.area() - b.area());

    let spawn = partitions[0];
    spawn.type = 'spawn';
    partitions[partitions.length - 1].type = 'boss';

    let connected = [spawn];
    let frontier = [spawn];

    let found_boss = false;
    let found_boss_counter = 0;
    let connections_after_boss = 0;

    // connect rooms until we find the boss, and then some
    while (frontier.length > 0) {
        let room = frontier[0];
        frontier.splice(0, 1);

        let doors_found = 0;
        let num_doors = Math.floor(Math.random() * 2 + 1);

        let tries = 0;
        let max_tries = 100;

        while (doors_found < num_doors) {
            let point = room.get_branch_point();
            for (const p of partitions) {
                if (p !== room && connected.indexOf(p) === -1 && p.point_next_to(point.x, point.y)) {
                    room.connections.push({ x: point.x, y: point.y, other: p });
                    p.connections.push({ x: point.x, y: point.y, other: room });
                    frontier.push(p);
                    connected.push(p);
                    doors_found++;
                    if (p.type === 'boss') found_boss = true;
                    break;
                }
            }
            tries++;
            if (tries > max_tries) {
                break;
            }
        }

        if (found_boss) found_boss_counter++;
        if (found_boss_counter > connections_after_boss) break;
    }

    // remove rooms we haven't connected to yet
    for (const partition of partitions) {
        if (partition.connections.length === 0) partitions = partitions.filter(p => p !== partition);
    }
    populate_grid(); // recalculate with removed rooms

    // make sure we haven't removed all the rooms
    if (partitions.length === 0) {
        return []; // for now just return an empty list so we can retry
    }

    // make some loops
    let num_loop_doors = Math.floor(Math.random() * 4 + 4);
    for (let i = 0; i < num_loop_doors; i++) {
        let roomIndex = Math.floor(Math.random() * partitions.length);
        let room = partitions[roomIndex];

        let found_door = false;

        let tries = 0;
        let max_tries = 100;

        let not_already_connected = partitions.filter(p => room.connections.filter(c => c.other === p).length === 0);

        while (!found_door) {
            let point = room.get_branch_point();
            for (const p of not_already_connected) {
                if (p !== room && p.point_next_to(point.x, point.y)) {
                    room.connections.push({ x: point.x, y: point.y, other: p });
                    p.connections.push({ x: point.x, y: point.y, other: room });
                    found_door = true;
                    break;
                }
            }
            tries++;
            if (tries > max_tries) {
                break;
            }
        }
    }

    // calculate room distances
    frontier = [spawn];
    seen = [];
    spawn.distance = 0;
    while (frontier.length > 0) {
        let room = frontier[0];
        frontier.splice(0, 1);
        seen.push(room);

        for (let c of room.connections) {
            let other = c.other;
            other.distance = Math.min(other.distance, room.distance + 1);

            if (seen.indexOf(other) === -1)
                frontier.push(other);
        }
    }

    return partitions;
}

let generate_dungeon = () => {
    let passes_checks = false;
    let partitions;

    let tries = 0;

    while (!passes_checks) {
        tries++;
        partitions = generate_dungeon_candidate();

        passes_checks = true;
        if (partitions.length < 6) passes_checks = false;
        if (partitions.filter(p => p.type === 'boss').length === 0) passes_checks = false;
        else if (partitions.filter(p => p.type === 'boss')[0].distance < 3) passes_checks = false;
    }

    console.log(tries + (tries === 1 ? ' try' : ' tries'));

    return partitions;
}

let partitions = generate_dungeon();

let draw = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    // draw

    partitions.forEach(p => p.draw());
};

document.addEventListener('keydown', (evt) => {
    if (evt.key === ' ') {

    }
});

setInterval(
    () => {
        draw();
    },
    1000 / FRAMERATE);