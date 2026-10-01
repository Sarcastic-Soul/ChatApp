import {
    ActionIcon,
    useMantineColorScheme,
    Menu,
    ColorSwatch,
    Group,
    SegmentedControl,
    Tooltip,
} from "@mantine/core";
import { PaletteIcon, CheckIcon } from "@phosphor-icons/react";
import useThemeStore from "../zustand/useThemeStore";
import { accents } from "../theme";

const ThemeToggle = (props) => {
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const { primaryColor, setPrimaryColor } = useThemeStore();

    return (
        <Menu width={240} position="top-end" closeOnItemClick={false} {...props}>
            <Menu.Target>
                <Tooltip label="Appearance">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        aria-label="Appearance settings"
                    >
                        <PaletteIcon size={20} />
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>

            <Menu.Dropdown p="sm">
                <Menu.Label px={0}>Mode</Menu.Label>
                <SegmentedControl
                    fullWidth
                    size="xs"
                    value={colorScheme}
                    onChange={setColorScheme}
                    data={[
                        { label: "Light", value: "light" },
                        { label: "Dark", value: "dark" },
                        { label: "Auto", value: "auto" },
                    ]}
                />
                <Menu.Label px={0} mt="sm">
                    Accent
                </Menu.Label>
                <Group gap={8}>
                    {Object.entries(accents).map(([name, { label, base }]) => (
                        <Tooltip key={name} label={label}>
                            <ColorSwatch
                                component="button"
                                type="button"
                                color={base}
                                size={28}
                                onClick={() => setPrimaryColor(name)}
                                aria-label={label}
                                aria-pressed={primaryColor === name}
                                style={{ cursor: "pointer", color: "#fbf9f4" }}
                            >
                                {primaryColor === name && (
                                    <CheckIcon size={14} weight="bold" />
                                )}
                            </ColorSwatch>
                        </Tooltip>
                    ))}
                </Group>
            </Menu.Dropdown>
        </Menu>
    );
};

export default ThemeToggle;
