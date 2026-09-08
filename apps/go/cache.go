package main

import (
	"sync"
	"time"
)

type MemoryCache struct {
	mu     sync.RWMutex
	items  map[string]cacheItem
	groups map[string]int64
}

type cacheItem struct {
	value      interface{}
	version    int64
	expiration time.Time
}

func NewMemoryCache() *MemoryCache {
	return &MemoryCache{
		items:  make(map[string]cacheItem),
		groups: make(map[string]int64),
	}
}

func (c *MemoryCache) GetGroupVersion(group string) int64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.groups[group]
}

func (c *MemoryCache) InvalidateGroup(group string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.groups[group]++
}

func (c *MemoryCache) Set(key string, val interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = cacheItem{
		value:      val,
		expiration: time.Now().Add(ttl),
	}
}

func (c *MemoryCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	item, ok := c.items[key]
	if !ok || time.Now().After(item.expiration) {
		return nil, false
	}
	return item.value, true
}
