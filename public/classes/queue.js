export default class Queue {
    constructor() {
        this.items = {}
        this.frontIndex = 0
        this.backIndex = 0
    }

    enqueue(item) {
        this.items[this.backIndex] = item
        this.backIndex++
        return item + ' inserted'
    }

    dequeue() {
        const item = this.items[this.frontIndex]
        delete this.items[this.frontIndex]
        this.frontIndex++
        return item
    }

    getLength() {
        return Object.keys(this.items).length;
    }

    getTotal() {
        let total = 0;
        for (let i = this.frontIndex; i < this.backIndex; i++) {
            total += this.items[i];
        }
        return total;
    }

    capTotal(max) {
        let total = this.getTotal();
        while (total > max) {
            total -= this.dequeue();
        }
    }

    capTotalNum(max) {
        const length = this.getLength();
        for (let i = max; i < length; i++) {
            this.dequeue();
        }
    }

    peek() {
        return this.items[this.frontIndex]
    }
    
    get printQueue() {
        return this.items;
    }
}