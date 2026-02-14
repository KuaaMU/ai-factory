.PHONY: init up stop status monitor evolve generate test clean

init:
	@python -m factory.cli init $(SEED)

up:
	@python -m factory.cli up

stop:
	@python -m factory.cli stop

status:
	@python -m factory.cli status

monitor:
	@bash scripts/monitor.sh

evolve:
	@python -m factory.cli evolve

generate:
	@python -m factory.cli generate

test:
	@python -m pytest tests/ -v

clean:
	@rm -rf output/.claude output/memories output/docs output/projects output/logs
