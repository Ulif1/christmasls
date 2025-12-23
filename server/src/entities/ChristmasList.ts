import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { Item } from './Item';

@Entity()
export class ChristmasList {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @ManyToOne(() => User, user => user.lists)
  user!: User;

  @OneToMany(() => Item, item => item.list, { cascade: true })
  items!: Item[];
}